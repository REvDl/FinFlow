import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Теперь путь правильный
import { ScrollArea } from "@/components/ui/scroll-area"; // Теперь путь правильный
import { DayTransaction } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  transactions: DayTransaction[];
}

export function DayTransactionsModal({ isOpen, onClose, date, transactions }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl border-border bg-card/95 backdrop-blur-md shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            Transactions for {date}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="mt-4 h-[450px] pr-4 text-foreground">
          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col gap-1 text-foreground">
                    <span className="font-semibold text-sm leading-none">{tx.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                      {tx.category}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm tracking-tight text-foreground">
                      {tx.converted_amount.toLocaleString()} {tx.display_currency}
                    </div>
                    {tx.currency !== tx.display_currency && (
                       <div className="text-[10px] text-muted-foreground">
                         {tx.amount} {tx.currency}
                       </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground italic text-sm">
              No transactions for this day
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}