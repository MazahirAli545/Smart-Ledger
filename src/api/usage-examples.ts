// src/api/usage-examples.ts
// Comprehensive usage examples for all Khatabook Ledger APIs

import { apiService } from './ApiService';
import { TransactionFilters, ReportFilters } from './index';

/**
 * USAGE EXAMPLES FOR ALL KHATABOOK LEDGER APIs
 *
 * This file demonstrates how to use all the implemented APIs
 * that match the Postman Collection endpoints.
 */

export class ApiUsageExamples {
  // ========================================
  // AUTHENTICATION EXAMPLES
  // ========================================

  static async authenticationExamples() {
    try {
      // 1. Send OTP
      console.log('📱 Sending OTP...');
      const otpResponse = await apiService.sendOtp('+919876543210');
      console.log('OTP sent:', otpResponse);

      // 2. Verify OTP
      console.log('🔐 Verifying OTP...');
      const verifyResponse = await apiService.verifyOtp(
        '+919876543210',
        '123456',
      );
      console.log('OTP verified:', verifyResponse);

      // 3. Check SMS Status
      console.log('📊 Checking SMS status...');
      const smsStatus = await apiService.getSmsStatus();
      console.log('SMS status:', smsStatus);
    } catch (error) {
      console.error('Authentication error:', error);
    }
  }

  // ========================================
  // USER EXAMPLES
  // ========================================

  static async userExamples() {
    try {
      // 1. Get User Profile
      console.log('👤 Getting user profile...');
      const profile = await apiService.getUserProfile();
      console.log('User profile:', profile);
    } catch (error) {
      console.error('User error:', error);
    }
  }

  // ========================================
  // CUSTOMER EXAMPLES
  // ========================================

  static async customerExamples() {
    try {
      // 1. Get All Customers
      console.log('🏢 Getting all customers...');
      const customers = await apiService.getCustomers();
      console.log('Customers:', customers);

      // 2. Get Customers Only (not suppliers)
      console.log('👥 Getting customers only...');
      const customersOnly = await apiService.getCustomersOnly('ABC');
      console.log('Customers only:', customersOnly);

      // 3. Get Suppliers
      console.log('🏭 Getting suppliers...');
      const suppliers = await apiService.getSuppliers();
      console.log('Suppliers:', suppliers);

      // 4. Create Customer
      console.log('➕ Creating customer...');
      const newCustomer = await apiService.createCustomer({
        partyName: 'ABC Company',
        partyType: 'Customer',
        phoneNumber: '+919876543210',
        address: '123 Main Street',
        gstNumber: '22ABCDE1234F1Z5',
        voucherType: 'receipt',
      });
      console.log('Created customer:', newCustomer);

      // 5. Update Customer
      console.log('✏️ Updating customer...');
      const updatedCustomer = await apiService.updateCustomer(newCustomer.id, {
        partyName: 'ABC Company Updated',
        address: '456 Updated Street',
      });
      console.log('Updated customer:', updatedCustomer);

      // 6. Get Customer by ID
      console.log('🔍 Getting customer by ID...');
      const customer = await apiService.getCustomerById(newCustomer.id);
      console.log('Customer details:', customer);

      // 7. Delete Customer
      console.log('🗑️ Deleting customer...');
      await apiService.deleteCustomer(newCustomer.id);
      console.log('Customer deleted successfully');
    } catch (error) {
      console.error('Customer error:', error);
    }
  }

  // ========================================
  // TRANSACTION EXAMPLES
  // ========================================

  static async transactionExamples() {
    try {
      // 1. Get All Transactions with Filters
      console.log('💰 Getting transactions with filters...');
      const filters: TransactionFilters = {
        page: 1,
        limit: 10,
        type: 'CREDIT',
        minAmount: 1000,
        maxAmount: 10000,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        customerName: 'ABC',
        category: 'Sales',
      };
      const transactions = await apiService.getTransactions(filters);
      console.log('Filtered transactions:', transactions);

      // 2. Create Transaction
      console.log('➕ Creating transaction...');
      const newTransaction = await apiService.createTransaction({
        customerId: 1,
        type: 'CREDIT',
        amount: 5000,
        description: 'Payment received from customer',
        invoiceNumber: 'INV-001',
        category: 'Sales',
        gstNumber: '22ABCDE1234F1Z5',
        items: [
          {
            name: 'Product A',
            quantity: 2,
            rate: 2000,
            amount: 4000,
          },
          {
            name: 'Product B',
            quantity: 1,
            rate: 1000,
            amount: 1000,
          },
        ],
        purchaseTerms: 'Net 30 days',
        attachments: ['invoice.pdf', 'receipt.jpg'],
        cGST: 450,
        sGST: 450,
        iGST: 0,
        gstPct: 18,
        discount: 100,
        shippingAmount: 50,
        subTotal: 5000,
        totalAmount: 5400,
        documentDate: '2024-01-15',
        method: 'Bank Transfer',
      });
      console.log('Created transaction:', newTransaction);

      // 3. Get Transaction by ID
      console.log('🔍 Getting transaction by ID...');
      const transaction = await apiService.getTransactionById(
        newTransaction.id,
      );
      console.log('Transaction details:', transaction);

      // 4. Update Transaction
      console.log('✏️ Updating transaction...');
      const updatedTransaction = await apiService.updateTransaction(
        newTransaction.id,
        {
          type: 'DEBIT',
          amount: 3000,
          description: 'Payment made to supplier',
          invoiceNumber: 'BILL-001',
          category: 'Purchase',
        },
      );
      console.log('Updated transaction:', updatedTransaction);

      // 5. Get Transactions by Customer
      console.log('👥 Getting transactions by customer...');
      const customerTransactions = await apiService.getTransactionsByCustomer(
        1,
        {
          page: 1,
          limit: 10,
          type: 'CREDIT',
        },
      );
      console.log('Customer transactions:', customerTransactions);

      // 6. Export Transactions CSV
      console.log('📊 Exporting transactions CSV...');
      const csvBlob = await apiService.exportTransactionsCSV({
        type: 'CREDIT',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      console.log('CSV exported:', csvBlob);

      // 7. Export Transactions PDF
      console.log('📄 Exporting transactions PDF...');
      const pdfBlob = await apiService.exportTransactionsPDF({
        type: 'CREDIT',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      console.log('PDF exported:', pdfBlob);

      // 8. Delete Transaction
      console.log('🗑️ Deleting transaction...');
      await apiService.deleteTransaction(newTransaction.id);
      console.log('Transaction deleted successfully');
    } catch (error) {
      console.error('Transaction error:', error);
    }
  }

  // ========================================
  // REPORT EXAMPLES
  // ========================================

  static async reportExamples() {
    try {
      // 1. Create Report
      console.log('📊 Creating report...');
      const reportFilters: ReportFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        customerIds: [1, 2, 3],
        supplierIds: [4, 5, 6],
        transactionTypes: ['CREDIT', 'DEBIT'],
        minAmount: 1000,
        maxAmount: 50000,
      };
      const newReport = await apiService.createReport({
        reportType: 'income_statement',
        title: 'Monthly Income Statement',
        description: 'Income statement for January 2024',
        filters: reportFilters,
      });
      console.log('Created report:', newReport);

      // 2. Get All Reports
      console.log('📋 Getting all reports...');
      const reports = await apiService.getReports(1, 10);
      console.log('Reports:', reports);

      // 3. Get Report by ID
      console.log('🔍 Getting report by ID...');
      const report = await apiService.getReportById(newReport.id);
      console.log('Report details:', report);

      // 4. Generate Report
      console.log('⚡ Generating report...');
      const generatedReport = await apiService.generateReport(newReport.id);
      console.log('Generated report:', generatedReport);

      // 5. Export Report CSV
      console.log('📊 Exporting report CSV...');
      const reportCsvBlob = await apiService.exportReportCSV(newReport.id);
      console.log('Report CSV exported:', reportCsvBlob);

      // 6. Export Report PDF
      console.log('📄 Exporting report PDF...');
      const reportPdfBlob = await apiService.exportReportPDF(newReport.id);
      console.log('Report PDF exported:', reportPdfBlob);

      // 7. Get Customer Ledger
      console.log('📖 Getting customer ledger...');
      const customerLedger = await apiService.getCustomerLedger(
        1,
        '2024-01-01',
        '2024-12-31',
      );
      console.log('Customer ledger:', customerLedger);

      // 8. Get Supplier Ledger
      console.log('📖 Getting supplier ledger...');
      const supplierLedger = await apiService.getSupplierLedger(
        1,
        '2024-01-01',
        '2024-12-31',
      );
      console.log('Supplier ledger:', supplierLedger);

      // 9. Get Daily Summary
      console.log('📅 Getting daily summary...');
      const dailySummary = await apiService.getDailySummary(
        '2024-01-01',
        '2024-01-31',
      );
      console.log('Daily summary:', dailySummary);

      // 10. Get Monthly Summary
      console.log('📅 Getting monthly summary...');
      const monthlySummary = await apiService.getMonthlySummary(
        '2024-01-01',
        '2024-12-31',
      );
      console.log('Monthly summary:', monthlySummary);

      // 11. Get Yearly Summary
      console.log('📅 Getting yearly summary...');
      const yearlySummary = await apiService.getYearlySummary(
        '2024-01-01',
        '2024-12-31',
      );
      console.log('Yearly summary:', yearlySummary);

      // 12. Delete Report
      console.log('🗑️ Deleting report...');
      await apiService.deleteReport(newReport.id);
      console.log('Report deleted successfully');
    } catch (error) {
      console.error('Report error:', error);
    }
  }

  // ========================================
  // RBAC EXAMPLES
  // ========================================

  static async rbacExamples() {
    try {
      // 1. Check User Role
      console.log('🔐 Checking user role...');
      const roleCheck = await apiService.checkUserRole('admin');
      console.log('Role check result:', roleCheck);

      // 2. Check User Permission
      console.log('🔑 Checking user permission...');
      const permissionCheck = await apiService.checkUserPermission(
        'CUSTOMER_CREATE',
      );
      console.log('Permission check result:', permissionCheck);

      // 3. Get User Roles
      console.log('👥 Getting user roles...');
      const userRoles = await apiService.getUserRoles();
      console.log('User roles:', userRoles);

      // 4. Get User Permissions
      console.log('🔑 Getting user permissions...');
      const userPermissions = await apiService.getUserPermissions();
      console.log('User permissions:', userPermissions);

      // 5. Get All Roles
      console.log('👥 Getting all roles...');
      const allRoles = await apiService.getAllRoles();
      console.log('All roles:', allRoles);

      // 6. Get All Permissions
      console.log('🔑 Getting all permissions...');
      const allPermissions = await apiService.getAllPermissions();
      console.log('All permissions:', allPermissions);
    } catch (error) {
      console.error('RBAC error:', error);
    }
  }

  // ========================================
  // UTILITY EXAMPLES
  // ========================================

  static async utilityExamples() {
    try {
      // 1. Check Authentication
      console.log('🔐 Checking authentication...');
      const isAuthenticated = await apiService.isAuthenticated();
      console.log('Is authenticated:', isAuthenticated);

      // 2. Get Auth Token
      console.log('🎫 Getting auth token...');
      const token = await apiService.getAuthToken();
      console.log('Auth token:', token ? 'Present' : 'Not found');

      // 3. Set Auth Token
      console.log('🎫 Setting auth token...');
      await apiService.setAuthToken('your-jwt-token-here');
      console.log('Auth token set');

      // 4. Clear Auth Token
      console.log('🗑️ Clearing auth token...');
      await apiService.clearAuthToken();
      console.log('Auth token cleared');
    } catch (error) {
      console.error('Utility error:', error);
    }
  }

  // ========================================
  // COMPLETE WORKFLOW EXAMPLE
  // ========================================

  static async completeWorkflowExample() {
    console.log('🚀 Starting complete Khatabook Ledger workflow...');

    try {
      // Step 1: Authentication
      await this.authenticationExamples();

      // Step 2: User Management
      await this.userExamples();

      // Step 3: Customer Management
      await this.customerExamples();

      // Step 4: Transaction Management
      await this.transactionExamples();

      // Step 5: Report Generation
      await this.reportExamples();

      // Step 6: RBAC Management
      await this.rbacExamples();

      // Step 7: Utility Functions
      await this.utilityExamples();

      console.log('✅ Complete workflow executed successfully!');
    } catch (error) {
      console.error('❌ Workflow error:', error);
    }
  }
}

// Export for easy usage
export default ApiUsageExamples;
