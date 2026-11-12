/**
 * SMS provider abstraction — swappable like the payment gateway adapter.
 * `demoMode` returns the code so the sandbox UI can show it (no real SMS in sandbox).
 */
export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<{ delivered: boolean; demoCode?: string }>;
}

class DemoSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string) {
    console.log(`[SMS:DEMO] کد ورود ${phone}: ${code}`);
    return { delivered: true, demoCode: code };
  }
}

// In production plug Kavenegar/SMS.ir here:
// class KavenegarProvider implements SmsProvider { ... }

let provider: SmsProvider = new DemoSmsProvider();
export function smsProvider(): SmsProvider { return provider; }
