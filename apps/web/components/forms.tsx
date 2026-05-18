import { Button } from "@/components/button";
import { accounts, customers } from "@/lib/demo";
import { formatCurrency } from "@bank/shared";

export function TransferForm() {
  return (
    <form className="panel grid gap-4 p-5">
      <div className="grid gap-2">
        <label className="label" htmlFor="from">From account</label>
        <select id="from" className="field" defaultValue={accounts[0]?.id}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.product} - {account.accountNumber.slice(-4)} - {formatCurrency(account.availableBalance)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="label" htmlFor="recipientType">Recipient type</label>
          <select id="recipientType" className="field" defaultValue="HANDLE">
            <option>HANDLE</option>
            <option>ACCOUNT_NUMBER</option>
            <option>IFSC_ACCOUNT</option>
          </select>
        </div>
        <div className="grid gap-2">
          <label className="label" htmlFor="recipient">Recipient</label>
          <input id="recipient" className="field" defaultValue="amanda.business" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="label" htmlFor="amount">Amount</label>
          <input id="amount" className="field" type="number" defaultValue="25000" />
        </div>
        <div className="grid gap-2">
          <label className="label" htmlFor="note">Note</label>
          <input id="note" className="field" defaultValue="Invoice settlement" />
        </div>
      </div>
      <div className="rounded-sm border border-teal-200 bg-teal-50 p-4 text-sm text-teal-700">
        Recipient confirmation shows only masked names after account/handle resolution to reduce enumeration risk.
      </div>
      <Button type="button" className="w-fit">Review transfer</Button>
    </form>
  );
}

export function KycWizard() {
  return (
    <form className="panel grid gap-5 p-5">
      <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-muted">
        {["Profile", "Documents", "Review"].map((step, index) => (
          <div key={step} className="rounded-sm bg-slate-100 px-4 py-2 text-center">
            {index + 1}. {step}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="label" htmlFor="name">Legal name</label>
          <input id="name" className="field" defaultValue={customers[0]?.name} />
        </div>
        <div className="grid gap-2">
          <label className="label" htmlFor="dob">Date of birth</label>
          <input id="dob" className="field" type="date" defaultValue="1994-08-22" />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <label className="label" htmlFor="address">Address</label>
          <input id="address" className="field" defaultValue="12 Residency Road, Bengaluru" />
        </div>
        <div className="grid gap-2">
          <label className="label" htmlFor="docType">Document type</label>
          <select id="docType" className="field" defaultValue="PAN">
            <option>PAN</option>
            <option>AADHAAR</option>
            <option>PASSPORT</option>
            <option>DRIVER_LICENSE</option>
          </select>
        </div>
        <div className="grid gap-2">
          <label className="label" htmlFor="docLast4">Document last 4</label>
          <input id="docLast4" className="field" maxLength={4} defaultValue="4321" />
        </div>
      </div>
      <div className="rounded-sm border border-line bg-slate-50 p-4 text-sm text-muted">
        Uploads use short-lived object storage URLs in production. The database stores metadata and masked document identifiers only.
      </div>
      <Button type="button" className="w-fit">Submit KYC</Button>
    </form>
  );
}

export function LoanApplicationForm() {
  return (
    <form className="panel grid gap-4 p-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="label" htmlFor="product">Product</label>
          <select id="product" className="field">
            <option>Home Flex Loan</option>
            <option>Business Growth Loan</option>
          </select>
        </div>
        <div className="grid gap-2">
          <label className="label" htmlFor="loanAmount">Amount</label>
          <input id="loanAmount" className="field" type="number" defaultValue="750000" />
        </div>
        <div className="grid gap-2">
          <label className="label" htmlFor="term">Term months</label>
          <input id="term" className="field" type="number" defaultValue="84" />
        </div>
        <div className="grid gap-2">
          <label className="label" htmlFor="income">Monthly income</label>
          <input id="income" className="field" type="number" defaultValue="125000" />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <label className="label" htmlFor="purpose">Purpose</label>
          <input id="purpose" className="field" defaultValue="Home renovation" />
        </div>
      </div>
      <Button type="button" className="w-fit">Submit application</Button>
    </form>
  );
}