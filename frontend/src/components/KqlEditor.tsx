import Editor from '@monaco-editor/react';

interface KqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
}

export function KqlEditor({ value, onChange, height = '200px' }: KqlEditorProps) {
  return (
    <Editor
      height={height}
      defaultLanguage="plaintext"
      theme="vs-dark"
      value={value}
      onChange={(val) => onChange(val || '')}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        padding: { top: 8 },
        tabSize: 2,
      }}
    />
  );
}
