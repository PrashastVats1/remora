import type { AttackCategory } from 'remora-engine';

// Human-readable labels and why-explanations per attack category.
export const CATEGORY_META: Record<AttackCategory, { label: string; intent: string; why: string }> = {
  'instruction-override': {
    label:  'Instruction override',
    intent: 'System tampering',
    why:    'Attempts to replace the agent\'s core instructions, making it ignore its original task and safety guidelines.',
  },
  'role-manipulation': {
    label:  'Role manipulation',
    intent: 'Identity hijacking',
    why:    'Tries to make the agent believe it is a different AI with different rules, bypassing its built-in behaviour.',
  },
  'data-exfiltration': {
    label:  'Data exfiltration',
    intent: 'Data theft',
    why:    'Instructs the agent to reveal confidential data — system prompts, conversation history, or user information — to an attacker.',
  },
  'action-manipulation': {
    label:  'Action manipulation',
    intent: 'Behaviour redirection',
    why:    'Redirects what the agent does or outputs, causing it to act against the user\'s intention without their knowledge.',
  },
  'conditional-trigger': {
    label:  'Conditional trigger',
    intent: 'Sleeper instruction',
    why:    'Plants a hidden instruction that activates later — for example, when a specific phrase is said — acting as a backdoor.',
  },
};
