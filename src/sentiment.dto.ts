export class ProcessTextDto {
  input: string;
  type: 'auto' | 'openrouter' | 'gemma3' | 'manual';
  installationId?: string;
}

export class ProcessTextV2Dto extends ProcessTextDto {
  incomeCategories?: string[];
  expenseCategories?: string[];
}

export class ProcessAudioDto {
  type: 'auto' | 'openrouter' | 'gemma3';
  installationId?: string;
  incomeCategories?: string[];
  expenseCategories?: string[];
}

export class ProcessImageDto {
  type?: 'auto' | 'openrouter' | 'gemma3';
  installationId?: string;
  incomeCategories?: string[];
  expenseCategories?: string[];
}