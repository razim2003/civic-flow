import { useState } from 'react'
import { Notice, SubmitButton } from '../../../shared/ui/Form'
import { useWithdrawal } from '../application/useWithdrawal'

export function WithdrawalPanel({ id, version, refreshing = false, onWithdrawn }: { id: string; version: number; refreshing?: boolean; onWithdrawn: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const state = useWithdrawal(id, version, onWithdrawn)
  return <section className="panel withdrawal-panel"><h2>Need to withdraw your complaint?</h2><p className="muted">You can withdraw it before resolution if it is no longer needed. Your complaint and its history will remain available.</p>
    {!open ? <button className="button button-secondary" type="button" disabled={refreshing} onClick={() => setOpen(true)}>Withdraw complaint</button> : <form noValidate onSubmit={(event) => { event.preventDefault(); if (!refreshing) void state.submit(reason, confirmed) }}>
      <p id="withdrawal-help" className="muted">This closes the complaint and stops further processing. Withdrawal cannot be undone.</p>
      {state.error && <Notice>{state.error}</Notice>}
      <fieldset disabled={state.busy || refreshing}><div className="field"><label htmlFor="withdrawal-reason">Reason for withdrawal</label><textarea id="withdrawal-reason" rows={4} value={reason} maxLength={2000} aria-describedby="withdrawal-help withdrawal-reason-hint" placeholder="For example, the issue was fixed, you made a duplicate report, or the complaint was submitted by mistake." onChange={(event) => setReason(event.target.value)} /><p id="withdrawal-reason-hint" className="field-hint">Explain your reason in 10 to 2,000 characters. It will be recorded in the complaint history.</p></div>
        <label className="checkbox-label withdrawal-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I understand this will close my complaint and cannot be undone.</label>
        <div className="button-row"><SubmitButton busy={state.busy}>Confirm withdrawal</SubmitButton><button type="button" className="button button-secondary" onClick={() => setOpen(false)}>Keep complaint</button></div>
      </fieldset>
    </form>}
  </section>
}
