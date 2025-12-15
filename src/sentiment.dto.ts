export class ProcessTextDto {
  input: string;
  type: 'auto' | 'openrouter' | 'gemma3' | 'manual';
  installationId?: string;
}
