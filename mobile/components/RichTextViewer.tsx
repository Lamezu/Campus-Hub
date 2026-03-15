import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import WebView from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';

interface RichTextViewerProps {
  html: string;
  searchQuery?: string;
  onSearchCount?: (count: number) => void;
}

function buildViewerHTML(html: string, textColor: string, bgColor: string, borderColor: string): string {
  return `<!DOCTYPE html>
<html lang="es"><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=3">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 16px;
      background: ${bgColor};
      color: ${textColor};
      font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
      font-size: 16px;
      line-height: 1.75;
      -webkit-text-size-adjust: none;
    }
    h1 { font-size: 22px; font-weight: 800; line-height: 1.3; margin: 12px 0 6px; }
    h2 { font-size: 18px; font-weight: 700; line-height: 1.35; margin: 10px 0 4px; }
    h3 { font-size: 15px; font-weight: 700; line-height: 1.4; margin: 8px 0 3px; }
    p { margin: 0 0 6px; }
    ul, ol { padding-left: 22px; margin: 4px 0 8px; }
    li { margin-bottom: 3px; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    u { text-decoration: underline; }
    s { text-decoration: line-through; }
    .ql-align-center { text-align: center; }
    .ql-align-right { text-align: right; }
    .ql-align-justify { text-align: justify; }
    .ql-indent-1 { padding-left: 3em; }
    .ql-indent-2 { padding-left: 6em; }
    .ql-indent-3 { padding-left: 9em; }
    blockquote {
      border-left: 4px solid ${borderColor};
      margin: 8px 0;
      padding: 4px 14px;
      color: ${borderColor};
    }
    code {
      background: ${borderColor}50;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
    }
    pre {
      background: ${borderColor}30;
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 14px;
    }
    a { color: #007AFF; text-decoration: none; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
      font-size: 14px;
      overflow-x: auto;
      display: block;
    }
    td, th {
      border: 1px solid ${borderColor};
      padding: 7px 10px;
      min-width: 50px;
      vertical-align: top;
      white-space: nowrap;
    }
    th {
      font-weight: 700;
      background: ${borderColor}22;
      text-align: left;
    }
    img { max-width: 100%; border-radius: 8px; }
    .tbl-del { display: none !important; }
    .tbl-wrap { position: static; margin: 10px 0; }
    mark.sh {
      background: #FFE08A;
      color: inherit;
      border-radius: 2px;
      padding: 0 1px;
    }
  </style>
</head>
<body>
${html}
</body></html>`;
}

const INJECT_HEIGHT = `
  (function() {
    function sendHeight() {
      var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: h }));
    }
    window.addEventListener('load', sendHeight);
    setTimeout(sendHeight, 300);
  })();
  true;
`;

function buildSearchJS(query: string): string {
  return `
    (function() {
      document.querySelectorAll('mark.sh').forEach(function(m) {
        var p = m.parentNode;
        p.replaceChild(document.createTextNode(m.textContent), m);
        p.normalize();
      });
      var count = 0;
      var q = ${JSON.stringify(query)};
      if (q && q.length > 0) {
        var ql = q.toLowerCase();
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        var nodes = [];
        var n;
        while ((n = walker.nextNode())) nodes.push(n);
        nodes.forEach(function(node) {
          var idx = node.textContent.toLowerCase().indexOf(ql);
          if (idx < 0) return;
          try {
            var range = document.createRange();
            range.setStart(node, idx);
            range.setEnd(node, idx + q.length);
            var mark = document.createElement('mark');
            mark.className = 'sh';
            range.surroundContents(mark);
            count++;
          } catch(e) {}
        });
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'searchCount', count: count }));
    })(); true;
  `;
}

export function RichTextViewer({ html, searchQuery, onSearchCount }: RichTextViewerProps) {
  const { colors } = useTheme();
  const wvRef = useRef<WebView>(null);
  const [webViewHeight, setWebViewHeight] = useState(200);

  const viewerHtml = React.useMemo(
    () => buildViewerHTML(html, colors.text, colors.background, colors.border),
    [html, colors.text, colors.background, colors.border],
  );

  useEffect(() => {
    if (!wvRef.current) return;
    wvRef.current.injectJavaScript(buildSearchJS(searchQuery ?? ''));
  }, [searchQuery]);

  return (
    <WebView
      ref={wvRef}
      source={{ html: viewerHtml, baseUrl: 'about:blank' }}
      style={[styles.webview, { height: webViewHeight, backgroundColor: colors.background }]}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      javaScriptEnabled
      originWhitelist={['*']}
      injectedJavaScript={INJECT_HEIGHT}
      onMessage={(e) => {
        try {
          const data = JSON.parse(e.nativeEvent.data);
          if (data.type === 'height') setWebViewHeight(data.value + 32);
          else if (data.type === 'searchCount') onSearchCount?.(data.count);
        } catch { /* ignore */ }
      }}
    />
  );
}

const styles = StyleSheet.create({
  webview: { width: '100%' },
});
