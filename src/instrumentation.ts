import { validateProductionEnvironment } from "@/lib/environment";

export function register() {
  validateProductionEnvironment();
}
