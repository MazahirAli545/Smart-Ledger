declare module 'react-native-razorpay' {
  interface RazorpayOptions {
    order_id: string;
    description?: string;
    image?: string;
    currency?: string;
    key: string;
    amount: number;
    name?: string;
    prefill?: {
      email?: string;
      contact?: string;
      name?: string;
    };
    theme?: {
      color?: string;
    };
    notes?: {
      [key: string]: string;
    };
    [key: string]: any;
  }

  interface RazorpayResponse {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
    [key: string]: any;
  }

  interface RazorpayError {
    code?: string;
    description?: string;
    message?: string;
    error?: string;
    reason?: string;
    type?: string;
    name?: string;
    [key: string]: any;
  }

  class RazorpayCheckout {
    static open(options: RazorpayOptions): Promise<RazorpayResponse>;
  }

  export default RazorpayCheckout;
}
