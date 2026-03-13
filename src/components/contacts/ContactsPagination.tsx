import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ContactsPaginationProps {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

const PER_PAGE_OPTIONS = [50, 100, 250, 500, 1000];

export function ContactsPagination({
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
}: ContactsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const from = Math.min((page - 1) * perPage + 1, total);
  const to = Math.min(page * perPage, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3">
      <p className="text-sm text-muted-foreground">
        Mostrando {from}-{to} de {total} contatos
      </p>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Por página:</span>
          <Select
            value={String(perPage)}
            onValueChange={(v) => onPerPageChange(Number(v))}
          >
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PER_PAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[60px] text-center">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
