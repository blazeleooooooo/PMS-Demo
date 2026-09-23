import { afterEach, describe, expect, it } from "vitest";
import {
  asanaHttpErrorMessage,
  collectAsanaTaskGidsFromLinks,
  parseAsanaLink,
  parseAsanaTaskGid,
} from "@/lib/asana";
import { filterImportedAsanaTasks } from "@/lib/asana-import-projects";
import {
  buildAsanaAuthorizeUrl,
  DEFAULT_ASANA_REDIRECT_URI,
  getAsanaOAuthConfig,
  resolveAsanaRedirectUri,
  safeAsanaReturnPath,
} from "@/lib/asana-oauth";

describe("parseAsanaTaskGid", () => {
  it("reads /task/{gid} URLs", () => {
    expect(
      parseAsanaTaskGid("https://app.asana.com/0/120/task/987654321")
    ).toBe("987654321");
  });

  it("reads classic /0/{project}/{task} URLs", () => {
    expect(parseAsanaTaskGid("https://app.asana.com/0/111/222/f")).toBe("222");
  });

  it("rejects non-task or non-asana URLs", () => {
    expect(parseAsanaTaskGid("https://app.asana.com/0/111")).toBeNull();
    expect(parseAsanaTaskGid("https://example.com/task/1")).toBeNull();
  });
});

describe("parseAsanaLink", () => {
  it("reads a project-only classic URL", () => {
    expect(parseAsanaLink("https://app.asana.com/0/111")).toEqual({
      taskGid: null,
      projectGid: "111",
    });
  });

  it("reads /1/{workspace}/project/{gid}/task/{gid}", () => {
    expect(
      parseAsanaLink("https://app.asana.com/1/999/project/456/task/789")
    ).toEqual({
      taskGid: "789",
      projectGid: "456",
    });
  });
});

describe("collectAsanaTaskGidsFromLinks", () => {
  it("collects task ids from mixed Asana URL formats", () => {
    const gids = collectAsanaTaskGidsFromLinks([
      "https://app.asana.com/1/0000000000000001/project/9000000000000002/task/9000000000000001?focus=true",
      "https://app.asana.com/0/111/222/f",
      "   ",
      null,
    ]);
    expect([...gids]).toEqual(["9000000000000001", "222"]);
  });
});

describe("filterImportedAsanaTasks", () => {
  it("hides tasks whose gid is already imported", () => {
    const { visible, hiddenCount } = filterImportedAsanaTasks(
      [{ gid: "111" }, { gid: "222" }, { gid: "333" }],
      new Set(["222"])
    );
    expect(visible.map((t) => t.gid)).toEqual(["111", "333"]);
    expect(hiddenCount).toBe(1);
  });
});

describe("safeAsanaReturnPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeAsanaReturnPath("/projects/bwa/abc?tab=asana")).toBe(
      "/projects/bwa/abc?tab=asana"
    );
  });

  it("rejects open redirects", () => {
    expect(safeAsanaReturnPath("https://evil.test/phish")).toBe("/");
    expect(safeAsanaReturnPath("//evil.test")).toBe("/");
    expect(safeAsanaReturnPath("not-a-path")).toBe("/");
  });
});

describe("buildAsanaAuthorizeUrl", () => {
  it("includes PKCE and the registered redirect", () => {
    const url = new URL(
      buildAsanaAuthorizeUrl({
        clientId: "client-1",
        redirectUri: DEFAULT_ASANA_REDIRECT_URI,
        state: "state-1",
        challenge: "challenge-1",
      })
    );
    expect(url.origin + url.pathname).toBe(
      "https://app.asana.com/-/oauth_authorize"
    );
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe(
      DEFAULT_ASANA_REDIRECT_URI
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-1");
  });
});

describe("getAsanaOAuthConfig", () => {
  const previous = {
    ASANA_CLIENT_ID: process.env.ASANA_CLIENT_ID,
    ASANA_CLIENT_SECRET: process.env.ASANA_CLIENT_SECRET,
    ASANA_OAUTH_REDIRECT_URI: process.env.ASANA_OAUTH_REDIRECT_URI,
  };

  afterEach(() => {
    process.env.ASANA_CLIENT_ID = previous.ASANA_CLIENT_ID;
    process.env.ASANA_CLIENT_SECRET = previous.ASANA_CLIENT_SECRET;
    process.env.ASANA_OAUTH_REDIRECT_URI = previous.ASANA_OAUTH_REDIRECT_URI;
  });

  it("defaults to the production callback", () => {
    process.env.ASANA_CLIENT_ID = "id";
    process.env.ASANA_CLIENT_SECRET = "secret";
    delete process.env.ASANA_OAUTH_REDIRECT_URI;
    expect(getAsanaOAuthConfig().redirectUri).toBe(DEFAULT_ASANA_REDIRECT_URI);
  });

  it("throws when client credentials are missing", () => {
    delete process.env.ASANA_CLIENT_ID;
    delete process.env.ASANA_CLIENT_SECRET;
    expect(() => getAsanaOAuthConfig()).toThrow(/ASANA_CLIENT_ID/);
  });
});

describe("resolveAsanaRedirectUri", () => {
  const previous = process.env.ASANA_OAUTH_REDIRECT_URI;

  afterEach(() => {
    process.env.ASANA_OAUTH_REDIRECT_URI = previous;
  });

  it("uses localhost callback when the request is local", () => {
    delete process.env.ASANA_OAUTH_REDIRECT_URI;
    expect(
      resolveAsanaRedirectUri("http://localhost:3000/api/asana/oauth/start")
    ).toBe("http://localhost:3000/api/asana/callback");
  });
});

describe("asanaHttpErrorMessage", () => {
  it("explains MCP tokens cannot call the REST API", () => {
    expect(
      asanaHttpErrorMessage(
        400,
        '{"errors":[{"message":"This endpoint requires an API app."}]}',
        "task"
      )
    ).toMatch(/MCP 應用/);
  });
});
