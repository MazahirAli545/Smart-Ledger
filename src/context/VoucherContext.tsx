import React, { createContext, useContext, useState } from 'react';

interface Voucher {
  [key: string]: any;
}

interface VoucherContextType {
  vouchers: Voucher[];
  appendVoucher: (voucher: Voucher) => void;
  setAllVouchers: (voucherList: Voucher[]) => void;
}

const VoucherContext = createContext<VoucherContextType | undefined>(undefined);

export const VoucherProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  const appendVoucher = (voucher: Voucher) => {
    setVouchers(prev => [voucher, ...prev]);
  };

  const setAllVouchers = (voucherList: Voucher[]) => {
    setVouchers(voucherList);
  };

  return (
    <VoucherContext.Provider
      value={{ vouchers, appendVoucher, setAllVouchers }}
    >
      {children}
    </VoucherContext.Provider>
  );
};

export const useVouchers = () => {
  const context = useContext(VoucherContext);
  if (!context)
    throw new Error('useVouchers must be used within a VoucherProvider');
  return context;
};
