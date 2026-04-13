import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWindowSize } from '../hooks/useWindowSize';
import { useTranslation } from '../hooks/useTranslation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight,
  Quote, Code, Table as TableIcon,
  Undo2, Redo2,
  Rows3, Columns3, Minus, Trash2,
} from 'lucide-react';

interface Colors {
  background: string;
  backgroundSecondary: string;
  border: string;
  text: string;
  textSecondary: string;
  primary: string;
}

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  colors: Colors;
  placeholder?: string;
  pageMode?: boolean;
  pageTitle?: string;
}

const GRID_ROWS = 10;
const GRID_COLS = 12;
const CELL = 26;
const GAP = 3;

function TableGridPicker({
  onPick, onClose, anchorRect, colors,
}: {
  onPick: (rows: number, cols: number) => void;
  onClose: () => void;
  anchorRect: DOMRect;
  colors: Colors;
}) {
  const [hover, setHover] = useState({ row: -1, col: -1 });
  const { t } = useTranslation();

  const pickerW = GRID_COLS * (CELL + GAP) + 20;
  const pickerH = GRID_ROWS * (CELL + GAP) + 52;

  let left = anchorRect.left;
  let top = anchorRect.bottom + 6;
  if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
  if (top + pickerH > window.innerHeight - 8) top = anchorRect.top - pickerH - 6;

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1998 }} />
      <div
        style={{
          position: 'fixed', top, left, zIndex: 1999,
          backgroundColor: colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: 12, padding: 10,
          boxShadow: '0 12px 36px rgba(0,0,0,0.22)',
        }}
        onMouseLeave={() => setHover({ row: -1, col: -1 })}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
          {Array.from({ length: GRID_ROWS }).map((_, r) => (
            <div key={r} style={{ display: 'flex', gap: GAP }}>
              {Array.from({ length: GRID_COLS }).map((_, c) => {
                const active = r <= hover.row && c <= hover.col;
                return (
                  <div
                    key={c}
                    onMouseEnter={() => setHover({ row: r, col: c })}
                    onClick={() => { onPick(r + 1, c + 1); onClose(); }}
                    style={{
                      width: CELL, height: CELL, borderRadius: 4,
                      border: `1.5px solid ${active ? colors.primary : colors.border}`,
                      backgroundColor: active ? colors.primary + '22' : colors.backgroundSecondary,
                      cursor: 'pointer',
                      transition: 'background-color 0.07s, border-color 0.07s',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 9, textAlign: 'center', fontSize: 13, fontWeight: 700, color: hover.row >= 0 ? colors.primary : colors.textSecondary }}>
          {hover.row >= 0 ? `${hover.row + 1} × ${hover.col + 1} ${t('rich_text.table')}` : t('rich_text.select_size')}
        </div>
      </div>
    </>,
    document.body,
  );
}

function ToolbarBtn({ onClick, active, title, children, disabled }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: 6, border: 'none',
        backgroundColor: active ? 'rgba(0,122,255,0.15)' : 'transparent',
        color: active ? '#007AFF' : 'inherit',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.35 : 1, flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 22, backgroundColor: 'rgba(128,128,128,0.18)', margin: '0 3px', flexShrink: 0 }} />;
}

function Toolbar({ editor, colors, pageMode, isMobile }: { editor: Editor; colors: Colors; pageMode?: boolean; isMobile?: boolean }) {
  const [tableAnchor, setTableAnchor] = useState<DOMRect | null>(null);
  const tableButtonRef = useRef<HTMLButtonElement>(null);
  const inTable = editor.isActive('table');
  const { t } = useTranslation();

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      flexWrap: isMobile ? 'nowrap' : 'wrap',
      overflowX: isMobile ? 'auto' : undefined,
      gap: 2,
      padding: pageMode ? '6px 16px' : '6px 8px',
      borderBottom: `1px solid ${colors.border}`,
      backgroundColor: pageMode ? colors.background : colors.backgroundSecondary,
      color: colors.text,
      flexShrink: 0,
      boxShadow: pageMode ? '0 1px 3px rgba(0,0,0,0.08)' : undefined,
      zIndex: 1,
    }}>
      <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title={t('rich_text.undo')}><Undo2 size={15} strokeWidth={2} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title={t('rich_text.redo')}><Redo2 size={15} strokeWidth={2} /></ToolbarBtn>
      <Sep />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title={t('rich_text.bold')}><Bold size={15} strokeWidth={2.5} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title={t('rich_text.italic')}><Italic size={15} strokeWidth={2} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title={t('rich_text.underline')}><UnderlineIcon size={15} strokeWidth={2} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title={t('rich_text.strikethrough')}><Strikethrough size={15} strokeWidth={2} /></ToolbarBtn>
      <Sep />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title={t('rich_text.heading1')}><Heading1 size={15} strokeWidth={2} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title={t('rich_text.heading2')}><Heading2 size={15} strokeWidth={2} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title={t('rich_text.heading3')}><Heading3 size={15} strokeWidth={2} /></ToolbarBtn>
      <Sep />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title={t('rich_text.bullet_list')}><List size={15} strokeWidth={2} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title={t('rich_text.ordered_list')}><ListOrdered size={15} strokeWidth={2} /></ToolbarBtn>
      <Sep />
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title={t('rich_text.align_left')}><AlignLeft size={15} strokeWidth={2} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title={t('rich_text.align_center')}><AlignCenter size={15} strokeWidth={2} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title={t('rich_text.align_right')}><AlignRight size={15} strokeWidth={2} /></ToolbarBtn>
      <Sep />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title={t('rich_text.blockquote')}><Quote size={15} strokeWidth={2} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title={t('rich_text.code')}><Code size={15} strokeWidth={2} /></ToolbarBtn>
      <Sep />
      <button
        ref={tableButtonRef}
        onMouseDown={e => {
          e.preventDefault();
          setTableAnchor(a => a ? null : tableButtonRef.current!.getBoundingClientRect());
        }}
        title={t('rich_text.insert_table')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 6, border: 'none',
          backgroundColor: (tableAnchor || inTable) ? 'rgba(0,122,255,0.15)' : 'transparent',
          color: (tableAnchor || inTable) ? '#007AFF' : 'inherit',
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        <TableIcon size={15} strokeWidth={2} />
      </button>
      {tableAnchor && (
        <TableGridPicker
          onPick={(r, c) => editor.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: true }).run()}
          onClose={() => setTableAnchor(null)}
          anchorRect={tableAnchor}
          colors={colors}
        />
      )}
      {inTable && (
        <>
          <Sep />
          <ToolbarBtn onClick={() => editor.chain().focus().addRowAfter().run()} title={t('rich_text.add_row')}><Rows3 size={15} strokeWidth={2} /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title={t('rich_text.add_column')}><Columns3 size={15} strokeWidth={2} /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().deleteRow().run()} title={t('rich_text.delete_row')}><Minus size={15} strokeWidth={2} /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().deleteColumn().run()} title={t('rich_text.delete_column')}><Minus size={13} strokeWidth={2.5} style={{ transform: 'rotate(90deg)' }} /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().deleteTable().run()} title={t('rich_text.delete_table')}><Trash2 size={13} strokeWidth={2} /></ToolbarBtn>
        </>
      )}
    </div>
  );
}

export default function RichTextEditor({ content, onChange, colors, placeholder, pageMode, pageTitle }: RichTextEditorProps) {
  const isDesktop = useWindowSize();
  const isMobile = !isDesktop;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== content) editor.commands.setContent(content || '', false);
  }, [content]);

  if (!editor) return null;

  const isEmpty = !editor.getText().trim();

  const editorStyles = `
    .ch-editor .tiptap { outline: none; }
    .ch-editor .tiptap table { border-collapse: collapse; width: 100%; }
    .ch-editor .tiptap td, .ch-editor .tiptap th {
      border: 1px solid ${colors.border}; padding: 7px 11px;
      min-width: 80px; position: relative; vertical-align: top;
    }
    .ch-editor .tiptap th { background: ${colors.backgroundSecondary}; font-weight: 700; }
    .ch-editor .tiptap .selectedCell::after {
      content: ''; position: absolute; inset: 0;
      background: ${colors.primary}22; pointer-events: none; z-index: 2;
    }
    .ch-editor .tiptap .column-resize-handle {
      position: absolute; right: -2px; top: 0; bottom: 0; width: 4px;
      background: ${colors.primary}; cursor: col-resize; z-index: 20; opacity: 0; transition: opacity 0.15s;
    }
    .ch-editor .tiptap td:hover .column-resize-handle,
    .ch-editor .tiptap th:hover .column-resize-handle,
    .ch-editor .tiptap .column-resize-handle:hover,
    .ch-editor .resize-cursor .column-resize-handle { opacity: 1; }
    .ch-editor .tiptap .tableWrapper { overflow-x: auto; margin: 10px 0; }
    .ch-editor .resize-cursor { cursor: col-resize; }
  `;

  if (pageMode) {
    const pagePadding = isMobile ? '20px 16px' : '72px 96px';
    const canvasPadding = isMobile ? '0' : '40px 24px';
    const placeholderLeft = isMobile ? 16 : 96;
    const placeholderTop = isMobile ? (pageTitle ? 80 : 20) : (pageTitle ? 140 : 72);

    return (
      <>
        <style>{editorStyles}</style>
        <div className="ch-editor" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <Toolbar editor={editor} colors={colors} pageMode isMobile={isMobile} />
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              backgroundColor: isMobile ? '#fff' : '#e8eaed',
              padding: canvasPadding,
            }}
            onClick={() => editor.commands.focus()}
          >
            <div
              style={{
                maxWidth: isMobile ? '100%' : 860,
                margin: '0 auto',
                backgroundColor: '#ffffff',
                boxShadow: isMobile ? 'none' : '0 1px 5px rgba(0,0,0,0.18)',
                borderRadius: isMobile ? 0 : 2,
                padding: pagePadding,
                minHeight: isMobile ? 'auto' : 1040,
                position: 'relative',
              }}
              onClick={e => e.stopPropagation()}
            >
              {pageTitle && (
                <div style={{ marginBottom: isMobile ? 16 : 32, paddingBottom: 12, borderBottom: '1px solid #e0e0e0' }}>
                  <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#202124', margin: 0 }}>{pageTitle}</h2>
                </div>
              )}
              <EditorContent
                editor={editor}
                className="ch-prose"
                style={{ color: '#202124', fontSize: 15, lineHeight: '28px', cursor: 'text' }}
              />
              {isEmpty && placeholder && (
                <div style={{ position: 'absolute', top: placeholderTop, left: placeholderLeft, pointerEvents: 'none', color: '#aaa', fontSize: 15 }}>
                  {placeholder}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{editorStyles}</style>
      <div
        className="ch-editor"
        style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.background }}
      >
        <Toolbar editor={editor} colors={colors} isMobile={isMobile} />
        <div style={{ position: 'relative', flex: 1 }}>
          <EditorContent
            editor={editor}
            className="ch-prose"
            style={{ minHeight: 280, padding: '14px 16px', color: colors.text, fontSize: 15, lineHeight: '26px', cursor: 'text' }}
          />
          {isEmpty && placeholder && (
            <div style={{ position: 'absolute', top: 14, left: 16, pointerEvents: 'none', color: colors.textSecondary, fontSize: 15 }}>
              {placeholder}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
