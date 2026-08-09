import { PaymentMethod } from '@prisma/client';
import { PaymentGateway } from './gateway.types';
import { paypalGateway } from './paypal.gateway';
import { mpesaGateway } from './mpesa.gateway';
import { visaGateway } from './visa.gateway';

const gateways: Record<PaymentMethod, PaymentGateway> = {
  PAYPAL: paypalGateway,
  MPESA: mpesaGateway,
  VISA: visaGateway,
};

export function getGateway(method: PaymentMethod): PaymentGateway {
  return gateways[method];
}
