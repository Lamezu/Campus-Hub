import React, { useRef, useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Text } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';
import { spacing } from '../constants/styles';
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Table2, RotateCcw, RotateCw,
} from 'lucide-react-native';

interface ActiveFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  header?: 1 | 2 | false;
  list?: 'bullet' | 'ordered' | null;
  align?: '' | 'center' | 'right';
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function buildHTML(
  initialHtml: string,
  text: string,
  bg: string,
  muted: string,
  border: string,
  placeholder: string,
): string {
  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0;min-height:100%;background:${bg}}
#body-wrap{padding:16px;position:relative}
#ed{
  min-height:80vh;outline:none;
  font-size:16px;line-height:1.75;color:${text};
  font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;
  word-break:break-word;
}
#ph{
  position:absolute;top:16px;left:16px;right:16px;
  color:${muted};font-size:16px;line-height:1.75;pointer-events:none;
  font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;
}
#ed h1{font-size:22px;font-weight:800;line-height:1.3;margin:10px 0 6px}
#ed h2{font-size:18px;font-weight:700;line-height:1.35;margin:8px 0 4px}
#ed h3{font-size:15px;font-weight:700;line-height:1.4;margin:6px 0 3px}
#ed p{margin:0 0 4px}
#ed ul,#ed ol{padding-left:22px;margin:4px 0 8px}
#ed li{margin-bottom:3px}
#ed blockquote{border-left:4px solid ${border};margin:8px 0;padding:4px 14px;color:${muted}}
#ed code{background:${border}55;padding:1px 5px;border-radius:4px;font-family:monospace;font-size:14px}
.tbl-wrap{margin:10px 0}
.tbl-wrap table,.tbl-wrap>table{
  border-collapse:collapse;width:100%;margin:0;font-size:14px;display:block;overflow-x:auto
}
#ed td,#ed th{border:1px solid ${border};padding:7px 10px;min-width:60px;vertical-align:top;white-space:nowrap;-webkit-user-select:none;user-select:none;}
#ed th{font-weight:700;background:${border}22;text-align:left}
::selection{background:rgba(0,122,255,0.25)}
#ctx{
  display:none;position:absolute;min-width:210px;
  background:#1c1c1e;border:1px solid rgba(255,255,255,0.14);
  border-radius:14px;overflow:hidden;z-index:500;
  box-shadow:0 8px 28px rgba(0,0,0,0.6);
}
.ctx-item{
  padding:13px 16px;font-size:15px;color:#fff;
  border-bottom:1px solid rgba(255,255,255,0.08);
  -webkit-user-select:none;user-select:none;
}
.ctx-item:last-child{border-bottom:none}
.ctx-item.danger{color:#FF3B30}
#mbar{
  display:none;position:fixed;top:0;left:0;right:0;
  background:#1c1c1e;padding:10px 14px;z-index:600;
  flex-direction:row;align-items:center;justify-content:space-between;
  border-bottom:1px solid rgba(255,255,255,0.12);
}
#mbar button{
  background:none;border:none;font-size:14px;padding:4px 0;
  cursor:pointer;min-width:68px;-webkit-appearance:none;
}
#mbar #m-cancel{color:rgba(255,255,255,0.55);text-align:left}
#mbar #m-label{color:#fff;font-size:12px;text-align:center;flex:1;padding:0 6px}
#mbar #m-ok{color:#FF3B30;font-weight:700;text-align:right;opacity:0.3;pointer-events:none}
</style>
</head><body>
<div id="mbar">
  <button id="m-cancel">Cancelar</button>
  <span id="m-label"></span>
  <button id="m-ok">Confirmar</button>
</div>
<div id="ctx"></div>
<div id="body-wrap">
  <div id="ph">${placeholder.replace(/</g, '&lt;')}</div>
  <div id="ed" contenteditable="true"></div>
</div>
<script>
var ed=document.getElementById('ed');
var ph=document.getElementById('ph');
var ctx=document.getElementById('ctx');
var mbar=document.getElementById('mbar');
var mCancel=document.getElementById('m-cancel');
var mLabel=document.getElementById('m-label');
var mOk=document.getElementById('m-ok');
var init=${JSON.stringify(initialHtml || '')};
if(init.trim()){ed.innerHTML=init;ph.style.display='none';}

// ── Core ──────────────────────────────────────────────────────────────────────
function rn(d){window.ReactNativeWebView.postMessage(JSON.stringify(d));}
function html(){
  var h=ed.innerHTML;
  return(!h||h==='<br>'||h==='<p><br></p>')?'':h;
}
function fmtState(){
  return{
    bold:document.queryCommandState('bold'),
    italic:document.queryCommandState('italic'),
    underline:document.queryCommandState('underline'),
    strike:document.queryCommandState('strikeThrough'),
    header:(function(){
      var t=document.queryCommandValue('formatBlock').toLowerCase();
      return t==='h1'?1:t==='h2'?2:false;
    })(),
    list:(function(){
      if(document.queryCommandState('insertUnorderedList'))return'bullet';
      if(document.queryCommandState('insertOrderedList'))return'ordered';
      return null;
    })(),
    align:(function(){
      if(document.queryCommandState('justifyCenter'))return'center';
      if(document.queryCommandState('justifyRight'))return'right';
      return'';
    })()
  };
}
function updatePh(){ph.style.display=ed.innerText.trim()?'none':'block';}

// ── Format suppression (fixes underline/strike toggle race) ───────────────────
var suppressFmt=false;
ed.addEventListener('input',function(){updatePh();rn({type:'change',html:html()});});
document.addEventListener('selectionchange',function(){
  if(!suppressFmt)rn({type:'format',format:fmtState()});
});
function run(cmd,val){
  suppressFmt=true;
  ed.focus();
  document.execCommand(cmd,false,val!=null?val:null);
  updatePh();
  rn({type:'change',html:html()});
  setTimeout(function(){suppressFmt=false;},80);
}

// ── Format commands ───────────────────────────────────────────────────────────
window.qBold=function(){run('bold');};
window.qItalic=function(){run('italic');};
window.qUnder=function(){run('underline');};
window.qStrike=function(){run('strikeThrough');};
window.qHeader=function(n){
  suppressFmt=true;
  ed.focus();
  if(!n){document.execCommand('formatBlock',false,'p');}
  else{
    var cur=document.queryCommandValue('formatBlock').toLowerCase();
    document.execCommand('formatBlock',false,cur==='h'+n?'p':'h'+n);
  }
  setTimeout(function(){suppressFmt=false;},80);
};
window.qList=function(t){run(t==='bullet'?'insertUnorderedList':'insertOrderedList');};
window.qAlign=function(a){run(a==='center'?'justifyCenter':a==='right'?'justifyRight':'justifyLeft');};
window.qIndent=function(d){
  suppressFmt=true;
  ed.focus();
  document.execCommand(d>0?'indent':'outdent',false,null);
  setTimeout(function(){suppressFmt=false;},80);
};
window.qUndo=function(){run('undo');};
window.qRedo=function(){run('redo');};

// ── Table insertion ───────────────────────────────────────────────────────────
window.qTable=function(rows,cols){
  ed.focus();
  var h='<div class="tbl-wrap"><table><thead><tr>';
  for(var i=0;i<cols;i++)h+='<th>Col '+(i+1)+'</th>';
  h+='</tr></thead><tbody>';
  for(var r=0;r<rows;r++){h+='<tr>';for(var c=0;c<cols;c++)h+='<td>&nbsp;</td>';h+='</tr>';}
  h+='</tbody></table></div><p><br></p>';
  document.execCommand('insertHTML',false,h);
  updatePh();rn({type:'change',html:html()});
};

// ── Table editing ─────────────────────────────────────────────────────────────
var tMode=null,tTable=null,tSel=[],tTargetRows=[],tTargetCols=[],lpTimer=null,addCount=1;

// ── Add-row/col panel (bottom sheet) ─────────────────────────────────────────
var addPanel=document.createElement('div');
addPanel.style.cssText='display:none;position:fixed;bottom:0;left:0;right:0;background:#1c1c1e;border-top:1px solid rgba(255,255,255,0.12);padding:16px;z-index:700;';
document.body.appendChild(addPanel);

function showAddPanel(mode){
  addCount=1;
  addPanel.innerHTML='';
  var title=document.createElement('div');
  title.style.cssText='color:#fff;font-size:15px;font-weight:600;text-align:center;margin-bottom:16px;';
  title.textContent=mode==='add-row'?'¿Cuántas filas añadir?':'¿Cuántas columnas añadir?';
  var row=document.createElement('div');
  row.style.cssText='display:flex;align-items:center;justify-content:center;gap:28px;margin-bottom:18px;';
  var minus=document.createElement('button');
  minus.textContent='−';
  minus.style.cssText='width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,0.14);border:none;color:#fff;font-size:24px;cursor:pointer;';
  var countEl=document.createElement('span');
  countEl.style.cssText='color:#fff;font-size:32px;font-weight:700;min-width:44px;text-align:center;';
  countEl.textContent='1';
  var plus=document.createElement('button');
  plus.textContent='+';
  plus.style.cssText='width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,0.14);border:none;color:#fff;font-size:24px;cursor:pointer;';
  minus.addEventListener('touchend',function(e){e.preventDefault();if(addCount>1){addCount--;countEl.textContent=String(addCount);}},{passive:false});
  plus.addEventListener('touchend',function(e){e.preventDefault();if(addCount<20){addCount++;countEl.textContent=String(addCount);}},{passive:false});
  row.appendChild(minus);row.appendChild(countEl);row.appendChild(plus);
  var btns=document.createElement('div');
  btns.style.cssText='display:flex;gap:10px;';
  var cancelB=document.createElement('button');
  cancelB.textContent='Cancelar';
  cancelB.style.cssText='flex:1;padding:13px;border-radius:10px;background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:15px;cursor:pointer;';
  cancelB.addEventListener('touchend',function(e){e.preventDefault();closeAddPanel();},{passive:false});
  var okB=document.createElement('button');
  okB.textContent='Añadir';
  okB.style.cssText='flex:1;padding:13px;border-radius:10px;background:#007AFF;border:none;color:#fff;font-size:15px;font-weight:600;cursor:pointer;';
  okB.addEventListener('touchend',function(e){
    e.preventDefault();
    if(mode==='add-row')doAddRows(addCount);else doAddCols(addCount);
    closeAddPanel();
  },{passive:false});
  btns.appendChild(cancelB);btns.appendChild(okB);
  addPanel.appendChild(title);addPanel.appendChild(row);addPanel.appendChild(btns);
  addPanel.style.display='block';
}
function closeAddPanel(){addPanel.style.display='none';cancelMode();}

function doAddRows(n){
  if(!tTable)return;
  var tbody=tTable.querySelector('tbody')||tTable;
  var firstRow=tTable.querySelector('tr');
  var cols=firstRow?firstRow.cells.length:1;
  for(var i=0;i<n;i++){
    var tr=document.createElement('tr');
    for(var c=0;c<cols;c++){var td=document.createElement('td');td.innerHTML='&nbsp;';tr.appendChild(td);}
    tbody.appendChild(tr);
  }
  updatePh();rn({type:'change',html:html()});
}
function doAddCols(n){
  if(!tTable)return;
  var rows=tTable.querySelectorAll('tr');
  var first=true;
  rows.forEach(function(row){
    for(var i=0;i<n;i++){
      var cell=document.createElement(first?'th':'td');
      cell.innerHTML=first?'Col':'&nbsp;';
      row.appendChild(cell);
    }
    first=false;
  });
  updatePh();rn({type:'change',html:html()});
}

// ── Context menu ──────────────────────────────────────────────────────────────
function mkCtxItem(label,cls,fn){
  var d=document.createElement('div');
  d.className='ctx-item'+(cls?' '+cls:'');
  d.textContent=label;
  d.addEventListener('touchend',function(e){e.preventDefault();e.stopPropagation();fn();},{passive:false});
  return d;
}
function showCtx(table,cell){
  tTable=table;ctx.innerHTML='';
  ctx.appendChild(mkCtxItem('Eliminar celdas/filas/cols','',function(){startMode('del');}));
  ctx.appendChild(mkCtxItem('Limpiar contenido de celdas','',function(){startMode('clear');}));
  ctx.appendChild(mkCtxItem('Combinar celdas','',function(){startMode('merge');}));
  ctx.appendChild(mkCtxItem('Borrar filas','',function(){startMode('del-row');}));
  ctx.appendChild(mkCtxItem('Borrar columnas','',function(){startMode('del-col');}));
  ctx.appendChild(mkCtxItem('Añadir filas','',function(){closeCtx();showAddPanel('add-row');}));
  ctx.appendChild(mkCtxItem('Añadir columnas','',function(){closeCtx();showAddPanel('add-col');}));
  ctx.appendChild(mkCtxItem('Borrar tabla','danger',function(){closeCtx();doDeleteTable();}));
  var rect=cell.getBoundingClientRect();
  var x=Math.max(4,Math.min(window.innerWidth-218,rect.left+window.pageXOffset));
  var y=rect.top+window.pageYOffset+rect.height+6;
  ctx.style.left=x+'px';ctx.style.top=y+'px';ctx.style.display='block';
  ed.blur();
  if(window.getSelection)window.getSelection().removeAllRanges();
}
function closeCtx(){ctx.style.display='none';}

// ── Mode bar helpers ──────────────────────────────────────────────────────────
function setReady(label){
  mOk.style.opacity='1';mOk.style.pointerEvents='auto';
  if(label)mLabel.textContent=label;
}
function setNotReady(label){
  mOk.style.opacity='0.3';mOk.style.pointerEvents='none';
  if(label)mLabel.textContent=label;
}

// ── Start mode ────────────────────────────────────────────────────────────────
function startMode(mode){
  closeCtx();
  tMode=mode;tSel=[];tTargetRows=[];tTargetCols=[];
  var labels={
    'del':'Toca celdas — filas/cols completas se eliminan, el resto se limpia',
    'clear':'Toca las celdas para limpiar su contenido',
    'merge':'Toca las celdas a combinar',
    'del-row':'Toca filas para seleccionarlas (puedes elegir varias)',
    'del-col':'Toca columnas para seleccionarlas (puedes elegir varias)'
  };
  mLabel.textContent=labels[mode]||'';
  mOk.style.opacity='0.3';mOk.style.pointerEvents='none';
  mbar.style.display='flex';
  document.body.style.paddingTop='50px';
  ed.blur();
  if(window.getSelection)window.getSelection().removeAllRanges();
  tTable.querySelectorAll('td,th').forEach(function(c){
    c.style.cursor='pointer';
    c.addEventListener('touchstart',onCellTap,{passive:false});
  });
}

// ── Cell tap handler ──────────────────────────────────────────────────────────
function onCellTap(e){
  if(!tMode||!tTable)return;
  e.preventDefault();e.stopPropagation();
  var cell=this;

  if(tMode==='del'||tMode==='clear'||tMode==='merge'){
    var idx=tSel.indexOf(cell);
    if(idx>=0){tSel.splice(idx,1);cell.style.background='';}
    else{
      tSel.push(cell);
      cell.style.background=tMode==='clear'?'rgba(255,149,0,0.38)':tMode==='merge'?'rgba(0,122,255,0.38)':'rgba(255,59,48,0.38)';
    }
    if(tSel.length>0)setReady(tSel.length+' celda'+(tSel.length>1?'s':''));
    else setNotReady(tMode==='clear'?'Toca las celdas para limpiar su contenido':tMode==='merge'?'Toca las celdas a combinar':'Toca celdas — filas/cols completas se eliminan');

  } else if(tMode==='del-row'){
    var row=cell.parentNode;
    var ri=tTargetRows.indexOf(row);
    if(ri>=0){
      tTargetRows.splice(ri,1);
      Array.from(row.cells).forEach(function(c){c.style.background='';});
    } else {
      tTargetRows.push(row);
      Array.from(row.cells).forEach(function(c){c.style.background='rgba(255,59,48,0.38)';});
    }
    if(tTargetRows.length>0)setReady(tTargetRows.length+' fila'+(tTargetRows.length>1?'s':''));
    else setNotReady('Toca filas para seleccionarlas');

  } else if(tMode==='del-col'){
    var ci=Array.from(cell.parentNode.cells).indexOf(cell);
    var cIdx=tTargetCols.indexOf(ci);
    if(cIdx>=0){
      tTargetCols.splice(cIdx,1);
      tTable.querySelectorAll('tr').forEach(function(r){if(r.cells[ci])r.cells[ci].style.background='';});
    } else {
      tTargetCols.push(ci);
      tTable.querySelectorAll('tr').forEach(function(r){if(r.cells[ci])r.cells[ci].style.background='rgba(255,59,48,0.38)';});
    }
    if(tTargetCols.length>0)setReady(tTargetCols.length+' columna'+(tTargetCols.length>1?'s':''));
    else setNotReady('Toca columnas para seleccionarlas');
  }
}

// ── Confirm ───────────────────────────────────────────────────────────────────
function doConfirm(){
  if(!tMode||!tTable)return;

  if(tMode==='del'){
    var allRows=Array.from(tTable.querySelectorAll('tr'));
    var maxCols=allRows.reduce(function(m,r){return Math.max(m,r.cells.length);},0);
    // Remove fully-selected rows first
    allRows.forEach(function(row){
      var cells=Array.from(row.cells);
      if(cells.length&&cells.every(function(c){return tSel.indexOf(c)>=0;}))row.remove();
    });
    // Remove fully-selected columns (descending index to preserve positions)
    var remRows=Array.from(tTable.querySelectorAll('tr'));
    if(remRows.length){
      var cols=[];for(var i=0;i<maxCols;i++)cols.push(i);
      cols.reverse().forEach(function(ci){
        if(remRows.every(function(r){var c=r.cells[ci];return c&&tSel.indexOf(c)>=0;})){
          remRows.forEach(function(r){if(r.cells[ci])r.deleteCell(ci);});
        }
      });
    }
    // Clear content of remaining selected cells (partial selection)
    tSel.forEach(function(c){if(c.parentNode){c.innerHTML='&nbsp;';c.style.background='';}});

  } else if(tMode==='clear'){
    tSel.forEach(function(c){if(c.parentNode){c.innerHTML='&nbsp;';c.style.background='';}});

  } else if(tMode==='merge'){
    if(tSel.length===1&&parseInt(tSel[0].colSpan||'1')>1){
      // Un-merge
      var mc=tSel[0];var span=parseInt(mc.colSpan);mc.colSpan=1;
      for(var s=1;s<span;s++){
        var nt=document.createElement(mc.tagName.toLowerCase());nt.innerHTML='&nbsp;';
        mc.parentNode.insertBefore(nt,mc.nextSibling);
      }
    } else if(tSel.length>=2){
      var first=tSel[0];
      var content=tSel.filter(function(c){return c.parentNode;})
        .map(function(c){return c.innerHTML.replace(/&nbsp;/g,'').trim();})
        .filter(Boolean).join(' ');
      first.innerHTML=content||'&nbsp;';first.colSpan=tSel.length;
      tSel.slice(1).forEach(function(c){if(c.parentNode)c.remove();});
    }

  } else if(tMode==='del-row'){
    tTargetRows.forEach(function(r){if(r.parentNode)r.remove();});

  } else if(tMode==='del-col'){
    // Delete descending so earlier indices aren't affected
    tTargetCols.slice().sort(function(a,b){return b-a;}).forEach(function(ci){
      tTable.querySelectorAll('tr').forEach(function(r){if(r.cells[ci])r.deleteCell(ci);});
    });
  }

  if(tTable&&tTable.parentNode&&!tTable.querySelector('tr')){
    var wrap=tTable.closest?tTable.closest('.tbl-wrap'):tTable.parentNode;
    if(wrap)wrap.remove();tTable=null;
  }
  cancelMode();
  updatePh();rn({type:'change',html:html()});
}

function doDeleteTable(){
  if(!tTable)return;
  var wrap=tTable.closest?tTable.closest('.tbl-wrap'):tTable.parentNode;
  if(wrap&&wrap!==ed)wrap.remove();else if(tTable.parentNode)tTable.remove();
  tTable=null;cancelMode();
  updatePh();rn({type:'change',html:html()});
}

function cancelMode(){
  if(tTable){
    tTable.querySelectorAll('td,th').forEach(function(c){
      c.style.background='';c.style.cursor='';
      c.removeEventListener('touchstart',onCellTap);
    });
  }
  tMode=null;tTable=null;tSel=[];tTargetRows=[];tTargetCols=[];
  mbar.style.display='none';
  document.body.style.paddingTop='0';
  ed.focus();
}

mCancel.addEventListener('touchend',function(e){e.preventDefault();cancelMode();},{passive:false});
mOk.addEventListener('touchend',function(e){e.preventDefault();doConfirm();},{passive:false});

// Long-press on any table cell
ed.addEventListener('touchstart',function(e){
  if(tMode)return;
  var td=e.target.closest?e.target.closest('td,th'):null;
  if(!td)return;
  var table=td.closest?td.closest('table'):null;
  if(!table)return;
  if(window.getSelection)window.getSelection().removeAllRanges();
  lpTimer=setTimeout(function(){showCtx(table,td);},500);
},{passive:true});
ed.addEventListener('touchmove',function(){clearTimeout(lpTimer);},{passive:true});
ed.addEventListener('touchend',function(){clearTimeout(lpTimer);},{passive:true});

document.addEventListener('touchstart',function(e){
  if(ctx.style.display!=='none'&&!ctx.contains(e.target)&&!addPanel.contains(e.target)){
    closeCtx();
    if(!tMode)ed.focus();
  }
},{passive:true});
document.addEventListener('contextmenu',function(e){e.preventDefault();return false;});

rn({type:'ready'});
</script>
</body></html>`;
}

// ── Toolbar helpers ────────────────────────────────────────────────────────────

function TBtn({
  active, onPress, children,
}: { active?: boolean; onPress: () => void; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.tb, active && { backgroundColor: colors.primary + '22' }]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      {children}
    </TouchableOpacity>
  );
}

function TLabel({
  active, onPress, label,
}: { active?: boolean; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.tb, active && { backgroundColor: colors.primary + '22' }]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <Text style={[styles.tl, { color: active ? colors.primary : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Sep() {
  const { colors } = useTheme();
  return <View style={[styles.sep, { backgroundColor: colors.border }]} />;
}

const GRID_COLS = 8;
const GRID_ROWS = 8;
const CELL_PX = 27;

function TablePicker({ onConfirm }: {
  onConfirm: (rows: number, cols: number) => void;
}) {
  const { colors } = useTheme();
  const [sel, setSel] = useState({ r: 1, c: 1 });

  const updateSel = (e: any) => {
    const x: number = e.nativeEvent.locationX;
    const y: number = e.nativeEvent.locationY;
    setSel({
      c: Math.max(1, Math.min(GRID_COLS, Math.ceil(x / CELL_PX))),
      r: Math.max(1, Math.min(GRID_ROWS, Math.ceil(y / CELL_PX))),
    });
  };

  return (
    <View style={[tpStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[tpStyles.title, { color: colors.textSecondary }]}>TABLA</Text>
      <View
        style={tpStyles.grid}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={updateSel}
        onResponderMove={updateSel}
      >
        {Array.from({ length: GRID_ROWS }, (_, ri) => (
          <View key={ri} style={{ flexDirection: 'row' }}>
            {Array.from({ length: GRID_COLS }, (_, ci) => {
              const active = ri < sel.r && ci < sel.c;
              return (
                <View
                  key={ci}
                  style={[
                    tpStyles.cell,
                    active
                      ? { backgroundColor: colors.primary + '45', borderColor: colors.primary }
                      : { backgroundColor: 'transparent', borderColor: colors.border },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
      <Text style={[tpStyles.label, { color: colors.text }]}>{sel.r} × {sel.c}</Text>
      <TouchableOpacity
        style={[tpStyles.btn, { backgroundColor: colors.primary }]}
        onPress={() => onConfirm(sel.r, sel.c)}
        activeOpacity={0.85}
      >
        <Text style={tpStyles.btnText}>Insertar</Text>
      </TouchableOpacity>
    </View>
  );
}

const TOOLBAR_H = 44;

const tpStyles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: TOOLBAR_H + 8,
    right: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textAlign: 'center' },
  grid: { width: GRID_COLS * CELL_PX, height: GRID_ROWS * CELL_PX },
  cell: { width: CELL_PX, height: CELL_PX, borderWidth: 1 },
  label: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  btn: { paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

export function RichTextEditor({
  value, onChange, placeholder = 'Escribe aquí...',
}: RichTextEditorProps) {
  const { colors } = useTheme();
  const wv = useRef<WebView>(null);
  const [fmt, setFmt] = useState<ActiveFormat>({});
  const [showTable, setShowTable] = useState(false);
  const [html] = useState(() =>
    buildHTML(value, colors.text, colors.background, colors.textSecondary, colors.border, placeholder),
  );

  const js = useCallback((code: string) => {
    wv.current?.injectJavaScript(`${code};true;`);
  }, []);

  const onMsg = useCallback((e: WebViewMessageEvent) => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (d.type === 'change') onChange(d.html);
      else if (d.type === 'format') setFmt(d.format || {});
    } catch (_e) {}
  }, [onChange]);

  const tap = useCallback((
    update: (prev: ActiveFormat) => ActiveFormat,
    code: string,
  ) => {
    setFmt(prev => update(prev));
    js(code);
  }, [js]);

  const sz = 18;
  const sw = 1.8;
  const c = (on?: boolean) => on ? colors.primary : colors.text;

  return (
    <View style={styles.root}>
      <WebView
        ref={wv}
        source={{ html }}
        style={{ flex: 1, backgroundColor: colors.background }}
        onMessage={onMsg}
        keyboardDisplayRequiresUserAction={false}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        javaScriptEnabled
        originWhitelist={['*']}
      />

      {showTable && (
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={() => setShowTable(false)}
          activeOpacity={1}
        />
      )}

      {showTable && (
        <TablePicker
          onConfirm={(rows, cols) => {
            js(`qTable(${rows},${cols})`);
            setShowTable(false);
          }}
        />
      )}

      {/* Toolbar */}
      <View style={[styles.bar, { backgroundColor: colors.backgroundSecondary, borderTopColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          keyboardShouldPersistTaps="always"
        >
          <TBtn active={!!fmt.bold}      onPress={() => tap(p => ({ ...p, bold: !p.bold }),           'qBold()')}  ><Bold          size={sz} color={c(!!fmt.bold)}             strokeWidth={sw} /></TBtn>
          <TBtn active={!!fmt.italic}    onPress={() => tap(p => ({ ...p, italic: !p.italic }),       'qItalic()')}><Italic        size={sz} color={c(!!fmt.italic)}           strokeWidth={sw} /></TBtn>
          <TBtn active={!!fmt.underline} onPress={() => tap(p => ({ ...p, underline: !p.underline }), 'qUnder()')} ><Underline     size={sz} color={c(!!fmt.underline)}        strokeWidth={sw} /></TBtn>
          <TBtn active={!!fmt.strike}    onPress={() => tap(p => ({ ...p, strike: !p.strike }),       'qStrike()')}><Strikethrough size={sz} color={c(!!fmt.strike)}           strokeWidth={sw} /></TBtn>

          <Sep />

          <TLabel active={fmt.header === 1}                          onPress={() => tap(p => ({ ...p, header: p.header === 1 ? false : 1 }), 'qHeader(1)')} label="H1" />
          <TLabel active={fmt.header === 2}                          onPress={() => tap(p => ({ ...p, header: p.header === 2 ? false : 2 }), 'qHeader(2)')} label="H2" />
          <TLabel active={fmt.header === false || fmt.header == null} onPress={() => tap(p => ({ ...p, header: false }), 'qHeader(0)')} label="¶" />

          <Sep />

          <TBtn active={fmt.list === 'bullet'}  onPress={() => tap(p => ({ ...p, list: p.list === 'bullet'  ? null : 'bullet'  }), "qList('bullet')")}  ><List        size={sz} color={c(fmt.list === 'bullet')}  strokeWidth={sw} /></TBtn>
          <TBtn active={fmt.list === 'ordered'} onPress={() => tap(p => ({ ...p, list: p.list === 'ordered' ? null : 'ordered' }), "qList('ordered')")} ><ListOrdered size={sz} color={c(fmt.list === 'ordered')} strokeWidth={sw} /></TBtn>

          <Sep />

          <TBtn active={!fmt.align}             onPress={() => tap(p => ({ ...p, align: '' }),         "qAlign('')")}      ><AlignLeft   size={sz} color={c(!fmt.align)}             strokeWidth={sw} /></TBtn>
          <TBtn active={fmt.align === 'center'} onPress={() => tap(p => ({ ...p, align: 'center' }),   "qAlign('center')")}><AlignCenter size={sz} color={c(fmt.align === 'center')} strokeWidth={sw} /></TBtn>
          <TBtn active={fmt.align === 'right'}  onPress={() => tap(p => ({ ...p, align: 'right' }),    "qAlign('right')")} ><AlignRight  size={sz} color={c(fmt.align === 'right')}  strokeWidth={sw} /></TBtn>

          <Sep />

          <TLabel active={false} onPress={() => js('qIndent(-1)')} label="⇤" />
          <TLabel active={false} onPress={() => js('qIndent(1)')}  label="⇥" />

          <Sep />

          <TBtn active={showTable} onPress={() => setShowTable(v => !v)}>
            <Table2 size={sz} color={showTable ? colors.primary : colors.text} strokeWidth={sw} />
          </TBtn>

          <Sep />

          <TBtn active={false} onPress={() => js('qUndo()')}><RotateCcw size={sz} color={colors.text} strokeWidth={sw} /></TBtn>
          <TBtn active={false} onPress={() => js('qRedo()')} ><RotateCw  size={sz} color={colors.text} strokeWidth={sw} /></TBtn>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, gap: 2 },
  tb: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  tl: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  sep: { width: 1, height: 20, marginHorizontal: 4 },
});
