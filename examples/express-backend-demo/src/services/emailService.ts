import { logInfo } from "../utils/logger";

export function sendWelcomeEmail(email: string) {
  logInfo(`Sending welcome email to ${email}`);
}
