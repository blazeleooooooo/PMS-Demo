import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { assertStaffActiveForLogin } from "@/lib/auth/assert-staff-active";

// Server-side admin client — bypasses RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, password } = body;

    switch (action) {
      // ───────────────────────────────────────────────
      // Validate user exists in our system (returns user_type)
      // ───────────────────────────────────────────────
      case "validate_user": {
        if (!email) {
          return NextResponse.json(
            { success: false, error: "請輸入電郵地址" },
            { status: 400 }
          );
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Verify user exists in our system
        const { data: user, error: userError } = await supabaseAdmin
          .from("users")
          .select("id, email, user_type")
          .eq("email", normalizedEmail)
          .single();

        if (userError || !user) {
          return NextResponse.json(
            { success: false, error: "此電郵地址未註冊" },
            { status: 404 }
          );
        }

        const staffGate = await assertStaffActiveForLogin(
          supabaseAdmin,
          normalizedEmail
        );
        if (!staffGate.allowed) {
          return NextResponse.json(
            { success: false, error: staffGate.error },
            { status: 403 }
          );
        }

        return NextResponse.json({
          success: true,
          user_type: user.user_type,
        });
      }

      // ───────────────────────────────────────────────
      // Ensure auth user exists in Supabase Auth
      // (Called before signInWithOtp if user doesn't exist in auth yet)
      // ───────────────────────────────────────────────
      case "ensure_auth_user": {
        if (!email) {
          return NextResponse.json(
            { success: false, error: "請輸入電郵地址" },
            { status: 400 }
          );
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Verify user exists in our public.users table
        const { data: user, error: userError } = await supabaseAdmin
          .from("users")
          .select("id, email, user_type, special")
          .eq("email", normalizedEmail)
          .single();

        if (userError || !user) {
          return NextResponse.json(
            { success: false, error: "此電郵地址未註冊" },
            { status: 404 }
          );
        }

        const staffGate = await assertStaffActiveForLogin(
          supabaseAdmin,
          normalizedEmail
        );
        if (!staffGate.allowed) {
          return NextResponse.json(
            { success: false, error: staffGate.error },
            { status: 403 }
          );
        }

        // Check if auth user already exists
        const { data: authListData } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuth = authListData?.users?.find(
          (u) => u.email === normalizedEmail
        );

        if (!existingAuth) {
          // Create auth user with email confirmed
          const { error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            email_confirm: true,
            password: user.special || undefined, // Use "special" field as password if available
            user_metadata: {
              user_type: user.user_type,
              public_user_id: user.id,
            },
          });

          if (createError) {
            console.error("[ensure_auth_user] Create error:", createError);
            return NextResponse.json(
              { success: false, error: "無法建立驗證帳戶: " + createError.message },
              { status: 500 }
            );
          }
        }

        return NextResponse.json({
          success: true,
          message: "Auth user ensured",
        });
      }

      // ───────────────────────────────────────────────
      // Password fallback: validate password server-side,
      // ensure auth user has the password set, then let
      // client call signInWithPassword
      // ───────────────────────────────────────────────
      case "login_password": {
        if (!email || !password) {
          return NextResponse.json(
            { success: false, error: "請輸入電郵地址和密碼" },
            { status: 400 }
          );
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Look up the user in public.users table
        const { data: user, error: userError } = await supabaseAdmin
          .from("users")
          .select("id, email, special, user_type")
          .eq("email", normalizedEmail)
          .single();

        if (userError || !user) {
          return NextResponse.json(
            { success: false, error: "電郵地址或密碼不正確" },
            { status: 401 }
          );
        }

        const staffGate = await assertStaffActiveForLogin(
          supabaseAdmin,
          normalizedEmail
        );
        if (!staffGate.allowed) {
          return NextResponse.json(
            { success: false, error: staffGate.error },
            { status: 403 }
          );
        }

        // Verify password against "special" field
        if (!user.special || user.special !== password) {
          return NextResponse.json(
            { success: false, error: "電郵地址或密碼不正確" },
            { status: 401 }
          );
        }

        // Ensure auth user exists with this password
        // Strategy: attempt to create the user. If email_exists error is returned,
        // find them via paginated listUsers and update their password instead.
        let existingAuth: { id: string; identities?: { provider: string }[] } | null = null;
        const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: password,
          email_confirm: true,
          user_metadata: {
            user_type: user.user_type,
            public_user_id: user.id,
          },
        });

        if (createErr) {
          // If user already exists (email_exists error), find them and update password
          if (createErr.message?.includes("already been registered") || (createErr as any).code === "email_exists") {
            // Find the existing auth user by listing users
            // Use a paginated approach to find the specific user
            let foundUser: { id: string; identities?: { provider: string }[] } | null = null;
            let page = 1;
            const perPage = 50;
            
            while (!foundUser) {
              const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
                page,
                perPage,
              });
              
              if (listErr || !listData?.users?.length) break;
              
              const match = listData.users.find((u) => u.email === normalizedEmail);
              if (match) {
                foundUser = match;
                break;
              }
              
              if (listData.users.length < perPage) break;
              page++;
              if (page > 100) break; // Safety limit
            }

            if (foundUser) {
              existingAuth = foundUser;
            } else {
              // Cannot find user even though email_exists was returned
              // This shouldn't happen, but return a generic error
              console.error("[login_password] email_exists but user not found in listUsers");
              return NextResponse.json(
                { success: false, error: "驗證系統錯誤，請聯繫管理員" },
                { status: 500 }
              );
            }
          } else {
            console.error("[login_password] Create auth user error:", createErr);
            return NextResponse.json(
              { success: false, error: "無法建立驗證帳戶: " + createErr.message },
              { status: 500 }
            );
          }
        }

        // If user already existed, update their password
        if (existingAuth) {
          const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existingAuth.id, {
            password: password,
            email_confirm: true,
          });

          if (updateErr) {
            console.error("[login_password] Update auth user error:", updateErr);
            return NextResponse.json(
              { success: false, error: "無法更新驗證帳戶: " + updateErr.message },
              { status: 500 }
            );
          }

          // For OAuth-only users (e.g., signed up via Google), they may not have
          // an "email" identity. Without it, signInWithPassword will fail.
          const hasEmailIdentity = existingAuth.identities?.some(
            (identity) => identity.provider === "email"
          );

          if (!hasEmailIdentity) {
            // Generate a magic link to create the email identity
            const { error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
              type: "magiclink",
              email: normalizedEmail,
            });

            if (linkErr) {
              console.error("[login_password] Generate link error:", linkErr);
              // Non-fatal: signInWithPassword might still work
            }

            // Re-set password after identity creation
            await supabaseAdmin.auth.admin.updateUserById(existingAuth.id, {
              password: password,
              email_confirm: true,
            });
          }
        }

        return NextResponse.json({
          success: true,
          user_type: user.user_type,
        });
      }

      // ───────────────────────────────────────────────
      // Record successful login timestamp (for idle-staff automation)
      // ───────────────────────────────────────────────
      case "record_login": {
        if (!email) {
          return NextResponse.json(
            { success: false, error: "缺少電郵地址" },
            { status: 400 }
          );
        }

        const normalizedEmail = email.toLowerCase().trim();
        const now = new Date().toISOString();

        const { error: updateError } = await supabaseAdmin
          .from("users")
          .update({ last_login_at: now, modified_date: now })
          .eq("email", normalizedEmail);

        if (updateError) {
          console.error("[record_login] update error:", updateError);
          return NextResponse.json(
            { success: false, error: updateError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      }

      // ───────────────────────────────────────────────
      // Get user profile after login
      // ───────────────────────────────────────────────
      case "get_profile": {
        if (!email) {
          return NextResponse.json(
            { success: false, error: "缺少電郵地址" },
            { status: 400 }
          );
        }

        const { data: profile, error: profileError } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("email", email.toLowerCase().trim())
          .single();

        if (profileError || !profile) {
          return NextResponse.json(
            { success: false, error: "找不到用戶資料" },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, profile });
      }

      default:
        return NextResponse.json(
          { success: false, error: "無效的操作" },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error("[api/auth/login] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "伺服器內部錯誤" },
      { status: 500 }
    );
  }
}
