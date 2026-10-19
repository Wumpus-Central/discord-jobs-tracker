export interface WebhookPayload {
  content?: string;
  embeds?: Embed[];
}

export interface EmbedFooter {
  text: string;
}

export interface Embed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: EmbedField[];
  footer?: EmbedFooter;
}

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}
