"use client";

import React, { useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { ResizableNodeView } from "@tiptap/core";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table as TableIcon,
  ImageIcon,
  Undo,
  Redo,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Default insert width — close to 10-day report PDF thumbnail scale */
const DEFAULT_IMAGE_WIDTH = 280;

function normalizeEditorHtml(html: string): string {
  return html
    .replace(/&nbsp;/gi, " ")
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

const IMAGE_SIZE_PRESETS = [
  { label: "S", width: 160, title: "小圖 (160px)" },
  { label: "M", width: 280, title: "中圖 (280px)" },
  { label: "L", width: 400, title: "大圖 (400px)" },
  { label: "全", width: null as number | null, title: "全寬" },
] as const;

function applyImageSizeStyles(
  el: HTMLImageElement,
  width: number | string | null | undefined,
  height: number | string | null | undefined
) {
  if (width != null && width !== "") {
    el.style.width = typeof width === "number" ? `${width}px` : String(width);
  } else {
    el.style.width = "";
  }
  if (height != null && height !== "") {
    el.style.height = typeof height === "number" ? `${height}px` : String(height);
  } else {
    el.style.height = "auto";
  }
}

/** TipTap Image with resize handles + attribute→DOM size sync for preset buttons */
const ResizableImage = Image.extend({
  addNodeView() {
    if (!this.options.resize || !this.options.resize.enabled || typeof document === "undefined") {
      return null;
    }
    const { directions, minWidth, minHeight, alwaysPreserveAspectRatio } = this.options.resize;
    return ({ node, getPos, HTMLAttributes, editor }) => {
      const el = document.createElement("img");
      el.draggable = false;
      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        if (value == null) return;
        if (key === "width" || key === "height") return;
        el.setAttribute(key, String(value));
      });
      if (HTMLAttributes.src) el.src = HTMLAttributes.src;
      applyImageSizeStyles(el, node.attrs.width, node.attrs.height);

      const nodeView = new ResizableNodeView({
        element: el,
        editor,
        node,
        getPos,
        onResize: (width, height) => {
          el.style.width = `${width}px`;
          el.style.height = `${height}px`;
        },
        onCommit: (width, height) => {
          const pos = getPos();
          if (pos === undefined) return;
          editor
            .chain()
            .setNodeSelection(pos)
            .updateAttributes(this.name, { width, height })
            .run();
        },
        onUpdate: (updatedNode) => {
          if (updatedNode.type.name !== this.name) return false;
          applyImageSizeStyles(el, updatedNode.attrs.width, updatedNode.attrs.height);
          if (updatedNode.attrs.src && el.getAttribute("src") !== updatedNode.attrs.src) {
            el.src = updatedNode.attrs.src;
          }
          return true;
        },
        options: {
          directions,
          min: { width: minWidth, height: minHeight },
          preserveAspectRatio: alwaysPreserveAspectRatio === true,
        },
      });

      const dom = nodeView.dom as HTMLElement;
      dom.style.visibility = "hidden";
      dom.style.pointerEvents = "none";
      el.onload = () => {
        dom.style.visibility = "";
        dom.style.pointerEvents = "";
      };
      return nodeView;
    };
  },
});

// Inline toolbar subcomponents to avoid circular imports with rich-text-editor.tsx
function ToolbarButton({
  children,
  active,
  disabled,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "w-7 h-7 flex items-center justify-center rounded transition-colors",
        active
          ? "bg-blue-100 text-blue-700"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
        disabled && "opacity-30 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-gray-200 mx-1" />;
}

interface RichTextEditorInnerProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  readOnly?: boolean;
}

export default function RichTextEditorInner({
  content,
  onChange,
  placeholder,
  className,
  minHeight = "120px",
  readOnly = false,
}: RichTextEditorInnerProps) {
  const extensions = React.useMemo(() => {
    const exts: any[] = [];
    try {
      if (StarterKit && typeof StarterKit.configure === "function") {
        exts.push(StarterKit.configure({ heading: { levels: [1, 2, 3] } }));
      } else if (StarterKit) {
        exts.push(StarterKit);
      }
      if (Underline) exts.push(Underline);
      // Block images (not inline) match PDF stacking; drag handles + presets persist width/height
      exts.push(
        ResizableImage.configure({
          inline: false,
          allowBase64: true,
          resize: {
            enabled: true,
            directions: ["top-left", "top-right", "bottom-left", "bottom-right"],
            minWidth: 80,
            minHeight: 60,
            alwaysPreserveAspectRatio: true,
          },
        })
      );
      if (Table && typeof Table.configure === "function") {
        exts.push(Table.configure({ resizable: true }));
      } else if (Table) {
        exts.push(Table);
      }
      if (TableRow) exts.push(TableRow);
      if (TableCell) exts.push(TableCell);
      if (TableHeader) exts.push(TableHeader);
      if (TextAlign && typeof TextAlign.configure === "function") {
        exts.push(TextAlign.configure({ types: ["heading", "paragraph"] }));
      } else if (TextAlign) {
        exts.push(TextAlign);
      }
    } catch (err) {
      console.error("Error initializing TipTap extensions:", err);
    }
    return exts;
  }, []);

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    // TipTap v3 defaults this off; needed so toolbar / image-size presets update on selection
    shouldRerenderOnTransaction: true,
    content: content || "",
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none px-3 py-2",
          "prose-headings:font-semibold prose-headings:text-gray-800",
          "prose-h1:text-lg prose-h2:text-base prose-h3:text-sm",
          "prose-p:text-[15px] prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-1",
          "prose-ul:text-[15px] prose-ol:text-[15px]",
          "prose-li:text-gray-700 prose-li:my-0",
          "prose-table:border-collapse prose-table:border prose-table:border-gray-200",
          "prose-td:border prose-td:border-gray-200 prose-td:p-2 prose-td:text-[14px]",
          "prose-th:border prose-th:border-gray-200 prose-th:p-2 prose-th:text-[14px] prose-th:bg-gray-50 prose-th:font-medium",
          "prose-img:rounded-md"
        ),
        style: `min-height: ${minHeight}`,
      },
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const next = content || "";
    const current = editor.getHTML();
    if (normalizeEditorHtml(current) === normalizeEditorHtml(next)) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, content]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        editor
          .chain()
          .focus()
          .setImage({ src: result, width: DEFAULT_IMAGE_WIDTH })
          .run();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [editor]);

  const setImageWidth = useCallback(
    (width: number | null) => {
      if (!editor || !editor.isActive("image")) return;
      const nextWidth =
        width == null
          ? Math.max(200, editor.view.dom.clientWidth - 24) // 全寬
          : width;
      editor
        .chain()
        .focus()
        .updateAttributes("image", { width: nextWidth, height: null })
        .run();
    },
    [editor]
  );

  const addTable = useCallback(() => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }, [editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "border border-gray-200 rounded-lg bg-white overflow-hidden",
          className
        )}
        style={{ minHeight }}
      />
    );
  }

  if (readOnly) {
    return (
      <div className={cn("border border-gray-100 rounded-lg bg-white overflow-hidden", className)}>
        <EditorContent editor={editor} />
      </div>
    );
  }

  const imageSelected = editor.isActive("image");
  const currentImageWidth = imageSelected
    ? (editor.getAttributes("image").width as number | null | undefined)
    : null;

  return (
    <div className={cn("border border-gray-200 rounded-lg bg-white overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50/80 flex-wrap">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="粗體"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜體"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="底線"
        >
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="標題 1"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="標題 2"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="標題 3"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="項目符號清單"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="編號清單"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="靠左對齊"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="置中對齊"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="靠右對齊"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={addTable} title="插入表格">
          <TableIcon className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={addImage} title="插入圖片">
          <ImageIcon className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="分隔線"
        >
          <Minus className="w-3.5 h-3.5" />
        </ToolbarButton>

        {imageSelected && (
          <>
            <ToolbarDivider />
            <span className="text-[11px] text-gray-400 px-1 select-none">圖片尺寸</span>
            {IMAGE_SIZE_PRESETS.map((preset) => {
              const isFull = preset.width == null;
              const fullWidth = Math.max(200, editor.view.dom.clientWidth - 24);
              const active = isFull
                ? typeof currentImageWidth === "number" &&
                  currentImageWidth >= fullWidth - 8
                : currentImageWidth === preset.width;
              return (
                <ToolbarButton
                  key={preset.label}
                  active={!!active}
                  onClick={() => setImageWidth(preset.width)}
                  title={preset.title}
                >
                  <span className="text-[11px] font-medium leading-none">{preset.label}</span>
                </ToolbarButton>
              );
            })}
          </>
        )}

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="復原"
        >
          <Undo className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="重做"
        >
          <Redo className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className={placeholder && !content ? "placeholder-visible" : ""}
      />
    </div>
  );
}
