import { Injectable, Logger } from "@nestjs/common";

/**
 * SMS provider abstraction — swappable like the payment gateway adapter.
 * `demoMode` returns the code so the sandbox UI can show it (no real SMS in sandbox).
 * In production plug Kavenegar / SMS.ir by implementing SmsProvider.
 */
export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<{ delivered: boolean; demoCode?: string }>;
}

class DemoSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string) {
    Logger.log(`کد ورود ${phone}: ${code}`, "SMS:DEMO");
    return { delivered: true, demoCode: code };
  }
}

@Injectable()
export class SmsService {
  private provider: SmsProvider = new DemoSmsProvider();

  get(): SmsProvider {
    return this.provider;
  }

  register(provider: SmsProvider) {
    this.provider = provider;
  }
}
