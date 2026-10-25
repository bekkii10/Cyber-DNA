import { Node, Extension, mergeAttributes } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { CALLOUT_KINDS } from '../../notebook/sanitize';

// Observation / hypothesis / finding / action / warning / AI draft: structured blocks that keep facts and guesses apart.
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { kind: { default: 'observation', parseHTML: (el) => (CALLOUT_KINDS.includes(el.getAttribute('data-callout')) ? el.getAttribute('data-callout') : 'observation'), renderHTML: (a) => ({ 'data-callout': a.kind }) } };
  },
  parseHTML() { return [{ tag: 'div[data-callout]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes), 0]; },
  addCommands() {
    return {
      toggleCallout: (kind) => ({ commands, editor }) => {
        if (editor.isActive('callout', { kind })) return commands.lift('callout');
        if (editor.isActive('callout')) return commands.updateAttributes('callout', { kind });
        return commands.wrapIn('callout', { kind });
      },
    };
  },
});

// "/" menu. The React layer owns rendering; this plugin only reports state and handles keys.
export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addOptions() { return { getItems: () => [], onState: () => {} }; },
  addProseMirrorPlugins() {
    const opts = this.options;
    return [Suggestion({
      editor: this.editor,
      char: '/',
      allowSpaces: false,
      pluginKey: new PluginKey('slashCommand'),
      items: ({ query }) => opts.getItems(query),
      command: ({ editor, range, props }) => { editor.chain().focus().deleteRange(range).run(); props.run(editor); },
      render: () => {
        let props = null; let index = 0;
        const emit = () => opts.onState(props ? { items: props.items, index, rect: props.clientRect?.() || null, select: (i) => props.command(props.items[i]) } : null);
        return {
          onStart: (p) => { props = p; index = 0; emit(); },
          onUpdate: (p) => { props = p; index = Math.min(index, Math.max(0, p.items.length - 1)); emit(); },
          onKeyDown: ({ event }) => {
            if (!props || !props.items.length) return false;
            if (event.key === 'ArrowDown') { index = (index + 1) % props.items.length; emit(); return true; }
            if (event.key === 'ArrowUp') { index = (index + props.items.length - 1) % props.items.length; emit(); return true; }
            if (event.key === 'Enter' || event.key === 'Tab') { props.command(props.items[index]); return true; }
            return false;
          },
          onExit: () => { props = null; emit(); },
        };
      },
    })];
  },
});

export const buildExtensions = ({ getItems, onSlash, placeholder }) => [
  StarterKit.configure({ link: { openOnClick: false, autolink: false, protocols: ['http', 'https', 'mailto'], HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } } }),
  Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
  TaskList, TaskItem.configure({ nested: true }),
  Highlight, CharacterCount, Callout,
  Placeholder.configure({ placeholder }),
  SlashCommand.configure({ getItems, onState: onSlash }),
];
