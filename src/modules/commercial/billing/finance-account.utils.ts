import type { FinanceAccount } from './billing.types'

export function formatFinanceAccountPaymentInstructions(account: FinanceAccount) {
  if (account.accountType === 'cash') {
    return `Pay at ${account.displayName} (${account.accountName}).`
  }

  const parts = [account.bankName, account.accountName].filter(Boolean).join(' — ')
  const accountNumber = account.accountNumber ? ` · Account ${account.accountNumber}` : ''

  return `Pay by bank transfer to ${parts}${accountNumber}.`
}

export function formatFinanceAccountOptionLabel(account: FinanceAccount) {
  if (account.accountType === 'cash') {
    return `${account.displayName} (Cash)`
  }

  const number = account.accountNumber ? ` · ${account.accountNumber}` : ''
  return `${account.displayName}${number}`
}
