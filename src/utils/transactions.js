// Transfers in ("VIREMENT") and postal deposits ("VERSEMENT - ...") — the
// operations relevant to matching against student payment receipts.
function isTransferOrDeposit(transaction) {
  if (!transaction.details) return false;
  return transaction.details === 'VIREMENT' || transaction.details.startsWith('VERSEMENT');
}

function filterTransfersAndDeposits(releveResult) {
  const transactions = releveResult.transactions.filter(isTransferOrDeposit);

  return {
    extractedAt: releveResult.extractedAt,
    summary: releveResult.summary,
    transactionCount: transactions.length,
    invalidCount: transactions.filter((t) => !t.valid).length,
    transactions,
  };
}

module.exports = { filterTransfersAndDeposits };
