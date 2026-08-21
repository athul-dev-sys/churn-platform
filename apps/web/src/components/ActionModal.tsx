import React, { useState } from 'react';
import { CheckCircle2, Sparkles, X } from 'lucide-react';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCustomer?: string;
  defaultCampaign?: string;
  onSuccess?: (details: { customerId: string; campaign: string; notes: string }) => void;
}

export const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  onClose,
  defaultCustomer = '',
  defaultCampaign = 'Discount Offer',
  onSuccess,
}) => {
  const [customerId, setCustomerId] = useState(defaultCustomer);
  const [campaign, setCampaign] = useState(defaultCampaign);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Sync props when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setCustomerId(defaultCustomer);
      setCampaign(defaultCampaign);
      setNotes('');
      setSubmitted(false);
    }
  }, [isOpen, defaultCustomer, defaultCampaign]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      if (onSuccess) {
        onSuccess({ customerId, campaign, notes });
      }
      setTimeout(() => {
        onClose();
      }, 1400);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/80 bg-[#fffdfb] p-7 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={18} />
        </button>

        {submitted ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="mt-4 text-xl font-bold text-slate-900">Action Executed!</h3>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Retention action <b>{campaign}</b> has been logged for customer <b>{customerId || 'Selected Group'}</b>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#efe9ff] text-[#6421e8]">
                <Sparkles size={20} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Execute Retention Action</h2>
                <p className="text-xs text-slate-500">Apply a targeted retention campaign or custom offer</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Target Customer ID
                </label>
                <input
                  type="text"
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="e.g. 7590-VHVEG"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-xs text-slate-800 outline-none focus:border-[#6421e8] focus:ring-2 focus:ring-[#6421e8]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Retention Campaign / Playbook
                </label>
                <select
                  value={campaign}
                  onChange={(e) => setCampaign(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-800 outline-none focus:border-[#6421e8] focus:ring-2 focus:ring-[#6421e8]/20"
                >
                  <option value="Discount Offer">10% Monthly Charge Lock-in Discount</option>
                  <option value="Executive Sync">Executive Account Review Sync</option>
                  <option value="Contract Migration">1-Year Annual Contract Migration</option>
                  <option value="Autopay Promotion">Autopay Paperless Billing Credit</option>
                  <option value="Custom Support">Dedicated Account Manager Assigned</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Agent Notes / Instructions
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Log details about customer conversation, discount code, or agreement terms..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-[#6421e8] focus:ring-2 focus:ring-[#6421e8]/20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6421e8] to-[#7c22de] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-200 hover:opacity-95"
              >
                {submitting ? 'Applying Action...' : 'Confirm & Execute Action'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ActionModal;
