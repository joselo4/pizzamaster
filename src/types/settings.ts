// src/types/settings.ts

export interface TicketSettings {
  id?: string;
  business_name: string;
  business_address: string;
  business_phone: string;
  logo_url?: string;
  footer_text: string;
  show_logo: boolean;
  show_customer_name: boolean;
  paper_width: '58mm' | '80mm'; // Para impresoras térmicas
}

export interface TelegramSettings {
  id?: string;
  bot_token: string;
  chat_id: string;
  auto_backup: boolean; // Si es true, intentar backup al iniciar admin
  last_backup?: string;
}