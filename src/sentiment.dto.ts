export class ProcessTextDto {
  input: string;
  type: 'auto' | 'openrouter' | 'gemma3' | 'manual';
  installationId?: string;
}

export class ProcessTextV2Dto extends ProcessTextDto {
  incomeCategories?: string[];
  expenseCategories?: string[];
}
