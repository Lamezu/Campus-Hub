import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, 
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Type, Heading1, Heading2, Trash2, Undo, Redo,
  Table as TableIcon, ChevronDown, 
  Merge, Split, Eraser, PlusSquare, MinusSquare
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

interface ActiveStyles {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  listBullet: boolean;
  listOrdered: boolean;
  alignLeft: boolean;
  alignCenter: boolean;
  alignRight: boolean;
  h1: boolean;
  h2: boolean;
  p: boolean;
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = 300 }: RichTextEditorProps) {
  const { colors } = useTheme();
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [pickerGrid, setPickerGrid] = useState({ r: 3, c: 3 });
  
  const [selectionOrigin, setSelectionOrigin] = useState<{r: number, c: number} | null>(null);
  const [selectionCurrent, setSelectionCurrent] = useState<{r: number, c: number} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, visible: boolean}>({ x: 0, y: 0, visible: false });

  const [activeStyles, setActiveStyles] = useState<ActiveStyles>({
    bold: false, italic: false, underline: false, strikethrough: false,
    listBullet: false, listOrdered: false,
    alignLeft: true, alignCenter: false, alignRight: false,
    h1: false, h2: false, p: true
  });

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, []);

  const updateActiveStyles = useCallback(() => {
    if (!editorRef.current) return;
    const block = document.queryCommandValue('formatBlock').toLowerCase();
    setActiveStyles({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikethrough: document.queryCommandState('strikethrough'),
      listBullet: document.queryCommandState('insertUnorderedList'),
      listOrdered: document.queryCommandState('insertOrderedList'),
      alignLeft: document.queryCommandState('justifyLeft') || (!document.queryCommandState('justifyCenter') && !document.queryCommandState('justifyRight')),
      alignCenter: document.queryCommandState('justifyCenter'),
      alignRight: document.queryCommandState('justifyRight'),
      h1: block === 'h1',
      h2: block === 'h2',
      p: block === 'p' || block === 'div' || !block
    });
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (document.activeElement === editorRef.current) updateActiveStyles();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateActiveStyles]);

  const execCommand = (command: string, val: string | undefined = undefined) => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      updateActiveStyles();
      editorRef.current.focus();
    }
  };

  const handleInput = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) execCommand('outdent');
      else execCommand('indent');
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); execCommand('bold'); break;
        case 'i': e.preventDefault(); execCommand('italic'); break;
        case 'u': e.preventDefault(); execCommand('underline'); break;
        case 'z': 
          if (e.shiftKey) { e.preventDefault(); execCommand('redo'); }
          else { e.preventDefault(); execCommand('undo'); }
          break;
        case 'y': e.preventDefault(); execCommand('redo'); break;
      }
    }
  };

  const mapVirtualGrid = (table: HTMLTableElement) => {
    const grid: (HTMLElement | null)[][] = [];
    Array.from(table.rows).forEach((tr, r) => {
      if (!grid[r]) grid[r] = [];
      let cIndex = 0;
      Array.from(tr.cells).forEach(cell => {
        while (grid[r][cIndex]) cIndex++;
        const rs = parseInt(cell.getAttribute('rowspan') || '1');
        const cs = parseInt(cell.getAttribute('colspan') || '1');
        cell.setAttribute('data-row', r.toString());
        cell.setAttribute('data-col', cIndex.toString());
        for (let ir = 0; ir < rs; ir++) {
          for (let ic = 0; ic < cs; ic++) {
            if (!grid[r + ir]) grid[r + ir] = [];
            grid[r + ir][cIndex + ic] = cell;
          }
        }
        cIndex += cs;
      });
    });
  };

  const insertTable = (rows: number, cols: number) => {
    let html = '<div class="tbl-wrap"><table style="border-collapse: collapse; margin: 10px 0; min-width: 200px;"><thead><tr>';
    for (let c = 0; c < cols; c++) html += `<th data-row="0" data-col="${c}" style="border: 1px solid ${colors.border}; padding: 12px; background: ${colors.backgroundSecondary}; font-weight: 700; text-align: left;">Col ${c + 1}</th>`;
    html += '</tr></thead><tbody>';
    for (let r = 1; r <= rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) html += `<td data-row="${r}" data-col="${c}" style="border: 1px solid ${colors.border}; padding: 12px;">&nbsp;</td>`;
      html += '</tr>';
    }
    html += '</tbody></table></div><p><br></p>';
    execCommand('insertHTML', html);
    const table = editorRef.current?.querySelector('table:last-of-type') as HTMLTableElement;
    if (table) mapVirtualGrid(table);
    setShowTablePicker(false);
  };

  const getSelectedRange = (table: HTMLTableElement) => {
    if (!selectionOrigin || !selectionCurrent) return null;
    const selectedCells = Array.from(table.querySelectorAll('.selected-cell')) as HTMLElement[];
    if (selectedCells.length === 0) return null;
    let rStart = Infinity, rEnd = -Infinity, cStart = Infinity, cEnd = -Infinity;
    selectedCells.forEach(cell => {
      const r = parseInt(cell.getAttribute('data-row') || '0');
      const c = parseInt(cell.getAttribute('data-col') || '0');
      const rs = parseInt(cell.getAttribute('rowspan') || '1');
      const cs = parseInt(cell.getAttribute('colspan') || '1');
      rStart = Math.min(rStart, r);
      rEnd = Math.max(rEnd, r + rs - 1);
      cStart = Math.min(cStart, c);
      cEnd = Math.max(cEnd, c + cs - 1);
    });
    return { rStart, rEnd, cStart, cEnd };
  };

  const clearSelection = () => {
    if (!editorRef.current) return;
    editorRef.current.querySelectorAll('.selected-cell').forEach(c => c.classList.remove('selected-cell'));
    setSelectionOrigin(null);
    setSelectionCurrent(null);
  };

  const handleTableMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const cell = target.closest('td, th');
    if (cell && e.button === 0) {
      clearSelection();
      const r = parseInt(cell.getAttribute('data-row') || '0');
      const c = parseInt(cell.getAttribute('data-col') || '0');
      setSelectionOrigin({r, c});
      setSelectionCurrent({r, c});
      setIsDragging(true);
      setContextMenu(prev => ({ ...prev, visible: false }));
      cell.classList.add('selected-cell');
    }
  };

  const handleTableMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectionOrigin) return;
    const target = e.target as HTMLElement;
    const cell = target.closest('td, th');
    if (cell) {
      const r = parseInt(cell.getAttribute('data-row') || '0');
      const c = parseInt(cell.getAttribute('data-col') || '0');
      setSelectionCurrent({r, c});
      const table = cell.closest('table');
      if (!table) return;
      const rS = Math.min(selectionOrigin.r, r);
      const rE = Math.max(selectionOrigin.r, r);
      const cS = Math.min(selectionOrigin.c, c);
      const cE = Math.max(selectionOrigin.c, c);
      Array.from(table.querySelectorAll('td, th')).forEach(td => {
        const row = parseInt(td.getAttribute('data-row') || '0');
        const col = parseInt(td.getAttribute('data-col') || '0');
        const rs = parseInt(td.getAttribute('rowspan') || '1');
        const cs = parseInt(td.getAttribute('colspan') || '1');
        const overlaps = !(row + rs - 1 < rS || row > rE || col + cs - 1 < cS || col > cE);
        if (overlaps) td.classList.add('selected-cell');
        else td.classList.remove('selected-cell');
      });
    }
  };

  const handleTableMouseUp = () => {
    setIsDragging(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const cell = target.closest('td, th');
    if (cell) {
      e.preventDefault();
      const rect = editorRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (!cell.classList.contains('selected-cell')) {
        clearSelection();
        cell.classList.add('selected-cell');
        const r = parseInt(cell.getAttribute('data-row') || '0');
        const c = parseInt(cell.getAttribute('data-col') || '0');
        setSelectionOrigin({r, c});
        setSelectionCurrent({r, c});
      }
      setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, visible: true });
    } else {
      setContextMenu(prev => ({ ...prev, visible: false }));
    }
  };

  const getActiveTable = () => {
    if (!editorRef.current) return null;
    const selected = editorRef.current.querySelector('.selected-cell');
    return selected?.closest('table') as HTMLTableElement | null;
  };

  const performTableAction = (action: string) => {
    const table = getActiveTable();
    if (!table) return;
    const range = getSelectedRange(table);
    if (!range) return;

    switch (action) {
      case 'clear':
        table.querySelectorAll('.selected-cell').forEach(c => (c as HTMLElement).innerHTML = '&nbsp;');
        break;
      case 'deleteTable':
        table.closest('.tbl-wrap')?.remove();
        break;
      case 'deleteRows':
        for (let i = range.rEnd; i >= range.rStart; i--) {
          if (table.rows[i]) table.deleteRow(i);
        }
        mapVirtualGrid(table);
        break;
      case 'deleteCols':
        Array.from(table.rows).forEach(row => {
          for (let i = row.cells.length - 1; i >= 0; i--) {
            const cell = row.cells[i];
            const col = parseInt(cell.getAttribute('data-col') || '0');
            const cs = parseInt(cell.getAttribute('colspan') || '1');
            if (col >= range.cStart && col + cs - 1 <= range.cEnd) row.deleteCell(i);
            else if (col <= range.cEnd && col + cs - 1 >= range.cStart) {
              const reduction = Math.min(range.cEnd, col + cs - 1) - Math.max(range.cStart, col) + 1;
              cell.setAttribute('colspan', (cs - reduction).toString());
            }
          }
        });
        mapVirtualGrid(table);
        break;
      case 'addRow':
        const newRow = table.insertRow(range.rEnd + 1);
        let colCount = 0;
        Array.from(table.rows[0].cells).forEach(c => colCount += parseInt(c.getAttribute('colspan') || '1'));
        for (let i = 0; i < colCount; i++) {
          const newCell = newRow.insertCell(-1);
          newCell.innerHTML = '&nbsp;';
          newCell.style.border = `1px solid ${colors.border}`;
          newCell.style.padding = '12px';
        }
        mapVirtualGrid(table);
        break;
      case 'addCol':
        Array.from(table.rows).forEach(row => {
          const newCell = row.insertCell(-1);
          newCell.innerHTML = '&nbsp;';
          newCell.style.border = `1px solid ${colors.border}`;
          newCell.style.padding = '12px';
        });
        mapVirtualGrid(table);
        break;
      case 'merge':
        const cells = Array.from(table.querySelectorAll('.selected-cell')) as HTMLElement[];
        if (cells.length < 2) return;
        const first = cells[0];
        let combinedText = '';
        cells.forEach((c, idx) => {
          if (c.innerText.trim() && c.innerText.trim() !== '\u00A0') combinedText += (combinedText ? ' ' : '') + c.innerText.trim();
          if (idx > 0) c.remove();
        });
        first.innerHTML = combinedText || '&nbsp;';
        first.setAttribute('colspan', (range.cEnd - range.cStart + 1).toString());
        first.setAttribute('rowspan', (range.rEnd - range.rStart + 1).toString());
        mapVirtualGrid(table);
        break;
      case 'split':
        const selected = table.querySelector('.selected-cell') as HTMLElement;
        if (!selected) return;
        const rs = parseInt(selected.getAttribute('rowspan') || '1');
        const cs = parseInt(selected.getAttribute('colspan') || '1');
        if (rs === 1 && cs === 1) return;
        selected.removeAttribute('rowspan');
        selected.removeAttribute('colspan');
        const r = parseInt(selected.getAttribute('data-row') || '0');
        for (let ir = 0; ir < rs; ir++) {
          const targetRow = table.rows[r + ir];
          for (let ic = 0; ic < cs; ic++) {
            if (ir === 0 && ic === 0) continue;
            const newCell = targetRow.insertCell(-1);
            newCell.innerHTML = '&nbsp;';
            newCell.style.border = `1px solid ${colors.border}`;
            newCell.style.padding = '12px';
          }
        }
        mapVirtualGrid(table);
        break;
    }
    handleInput();
    setContextMenu(prev => ({ ...prev, visible: false }));
    clearSelection();
  };

  const ToolbarButton = ({ icon: Icon, command, value: cmdVal, label, isActive }: any) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); if (command) execCommand(command, cmdVal); }}
      title={label}
      style={{
        padding: '8px', borderRadius: '8px', border: 'none',
        backgroundColor: isActive ? colors.primary : 'transparent',
        color: isActive ? '#fff' : colors.text,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s', boxShadow: isActive ? `0 2px 8px ${colors.primary}40` : 'none',
      }}
    >
      <Icon size={18} strokeWidth={isActive ? 3 : 2} />
    </button>
  );

  return (
    <div 
      onClick={() => { if (document.activeElement !== editorRef.current) editorRef.current?.focus(); }}
      onMouseUp={handleTableMouseUp}
      style={{
        display: 'flex', flexDirection: 'column', borderRadius: 16,
        border: `1px solid ${isFocused ? colors.primary : colors.border}`,
        backgroundColor: colors.background, overflow: 'hidden', transition: 'border-color 0.2s',
        boxShadow: isFocused ? '0 0 0 2px ' + colors.primary + '15' : 'none', cursor: 'text',
        position: 'relative'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px',
          borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary + '40', cursor: 'default'
        }}
      >
        <ToolbarButton icon={Bold} command="bold" label="Negrita (Ctrl+B)" isActive={activeStyles.bold} />
        <ToolbarButton icon={Italic} command="italic" label="Cursiva (Ctrl+I)" isActive={activeStyles.italic} />
        <ToolbarButton icon={Underline} command="underline" label="Subrayado (Ctrl+U)" isActive={activeStyles.underline} />
        <ToolbarButton icon={Strikethrough} command="strikethrough" label="Tachado" isActive={activeStyles.strikethrough} />
        <div style={{ width: 1, height: 24, backgroundColor: colors.border, margin: '0 4px' }} />
        <ToolbarButton icon={Heading1} command="formatBlock" value="H1" label="Título 1" isActive={activeStyles.h1} />
        <ToolbarButton icon={Heading2} command="formatBlock" value="H2" label="Título 2" isActive={activeStyles.h2} />
        <ToolbarButton icon={Type} command="formatBlock" value="P" label="Párrafo" isActive={activeStyles.p} />
        <div style={{ width: 1, height: 24, backgroundColor: colors.border, margin: '0 4px' }} />
        <ToolbarButton icon={List} command="insertUnorderedList" label="Lista de viñetas" isActive={activeStyles.listBullet} />
        <ToolbarButton icon={ListOrdered} command="insertOrderedList" label="Lista numerada" isActive={activeStyles.listOrdered} />
        <div style={{ width: 1, height: 24, backgroundColor: colors.border, margin: '0 4px' }} />
        <ToolbarButton icon={AlignLeft} command="justifyLeft" label="Alinear izquierda" isActive={activeStyles.alignLeft} />
        <ToolbarButton icon={AlignCenter} command="justifyCenter" label="Centrar" isActive={activeStyles.alignCenter} />
        <ToolbarButton icon={AlignRight} command="justifyRight" label="Alinear derecha" isActive={activeStyles.alignRight} />
        <div style={{ width: 1, height: 24, backgroundColor: colors.border, margin: '0 4px' }} />
        <div style={{ position: 'relative' }}>
          <button
            onMouseDown={(e) => { e.preventDefault(); setShowTablePicker(!showTablePicker); }}
            style={{
              padding: '8px', borderRadius: '8px', border: 'none',
              backgroundColor: showTablePicker ? colors.primary + '20' : 'transparent',
              color: showTablePicker ? colors.primary : colors.text,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2
            }}
          >
            <TableIcon size={18} />
            <ChevronDown size={12} />
          </button>
          {showTablePicker && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4,
              backgroundColor: colors.card, border: `1px solid ${colors.border}`,
              borderRadius: 12, padding: 12, zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, marginBottom: 8, textAlign: 'center' }}>INSERTAR TABLA ({pickerGrid.r}x{pickerGrid.c})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
                {Array.from({ length: 8 }).map((_, r) => Array.from({ length: 8 }).map((_, c) => {
                  const isActive = r < pickerGrid.r && c < pickerGrid.c;
                  return (
                    <div key={`${r}-${c}`} onMouseEnter={() => setPickerGrid({ r: r + 1, c: c + 1 })} onMouseDown={(e) => { e.preventDefault(); insertTable(r, c + 1); }}
                      style={{ width: 14, height: 14, border: `1px solid ${isActive ? colors.primary : colors.border}`, backgroundColor: isActive ? colors.primary + '40' : 'transparent', cursor: 'pointer', borderRadius: 2 }} />
                  );
                }))}
              </div>
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <ToolbarButton icon={Undo} command="undo" label="Deshacer (Ctrl+Z)" />
        <ToolbarButton icon={Redo} command="redo" label="Rehacer (Ctrl+Y)" />
      </div>

      <div style={{ position: 'relative', minHeight, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!value && placeholder && !isFocused && (
          <div style={{ position: 'absolute', top: 20, left: 20, color: colors.textSecondary, pointerEvents: 'none', fontSize: 16, opacity: 0.5 }}>{placeholder}</div>
        )}
        <div
          ref={editorRef} contentEditable onInput={handleInput} onKeyDown={handleKeyDown}
          onFocus={() => { setIsFocused(true); updateActiveStyles(); }}
          onBlur={() => setIsFocused(false)}
          onMouseDown={handleTableMouseDown}
          onMouseMove={handleTableMouseMove}
          onContextMenu={handleContextMenu}
          style={{ padding: '20px', minHeight, outline: 'none', color: colors.text, fontSize: 16, lineHeight: 1.6, textAlign: 'left', flex: 1 }}
        />

        {contextMenu.visible && (
          <div style={{
            position: 'absolute', top: contextMenu.y, left: contextMenu.x, zIndex: 1000,
            backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12,
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)', width: 220, overflow: 'hidden', padding: '6px'
          }}>
            <button onClick={() => performTableAction('merge')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: colors.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <Merge size={16} /> Combinar celdas
            </button>
            <button onClick={() => performTableAction('split')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: colors.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <Split size={16} /> Dividir celdas
            </button>
            <button onClick={() => performTableAction('clear')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: colors.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <Eraser size={16} /> Limpiar contenido
            </button>
            <div style={{ height: 1, backgroundColor: colors.border, margin: '4px 6px' }} />
            <button onClick={() => performTableAction('addRow')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: colors.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <PlusSquare size={16} /> Añadir fila
            </button>
            <button onClick={() => performTableAction('addCol')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: colors.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <PlusSquare size={16} /> Añadir columna
            </button>
            <button onClick={() => performTableAction('deleteRows')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: colors.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <MinusSquare size={16} /> Borrar filas
            </button>
            <button onClick={() => performTableAction('deleteCols')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: colors.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <MinusSquare size={16} /> Borrar columnas
            </button>
            <div style={{ height: 1, backgroundColor: colors.border, margin: '4px 6px' }} />
            <button onClick={() => performTableAction('deleteTable')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: '#ff4d4d', fontSize: 14, fontWeight: 600, cursor: 'pointer', borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ff4d4d15'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <Trash2 size={16} /> Borrar tabla
            </button>
          </div>
        )}
      </div>

      <style>{`
        [contenteditable] { text-align: left; }
        [contenteditable] h1 { font-size: 28px; margin: 15px 0 10px 0; font-weight: 800; border-bottom: 1px solid ${colors.border}; padding-bottom: 5px; }
        [contenteditable] h2 { font-size: 22px; margin: 12px 0 8px 0; font-weight: 700; }
        [contenteditable] p { margin-bottom: 8px; }
        [contenteditable] ul, [contenteditable] ol { padding-left: 25px; margin-bottom: 12px; }
        [contenteditable] table { border-collapse: collapse; min-width: 200px; max-width: 100%; border: 1px solid ${colors.border}; user-select: text; }
        [contenteditable] th, [contenteditable] td { border: 1px solid ${colors.border}; padding: 12px; word-break: break-word; position: relative; }
        [contenteditable] .selected-cell { background: ${colors.primary}20 !important; border: 2px solid ${colors.primary} !important; border-radius: 2px; }
        [contenteditable] ::selection { background: ${colors.primary}33; }
        .tbl-wrap { overflow-x: auto; margin: 10px 0; cursor: default; }
      `}</style>
    </div>
  );
}
