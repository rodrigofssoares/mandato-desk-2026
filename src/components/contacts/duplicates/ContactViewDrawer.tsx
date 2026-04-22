import { useState } from "react";
import { ChevronDown, Star, Phone, Mail, MapPin, Instagram, Twitter } from "lucide-react";
import type { DuplicateContact } from "@/hooks/useDuplicates";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { getContactDisplayName } from "@/lib/contactDisplay";

interface ContactViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: DuplicateContact | null;
}

function EmptyValue() {
  return <span className="text-muted-foreground text-sm">(vazio)</span>;
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-1">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function SectionHeader({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <CollapsibleTrigger
      onClick={onToggle}
      className="flex w-full items-center justify-between py-2 text-sm font-semibold hover:text-primary transition-colors"
    >
      {title}
      <ChevronDown
        className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
      />
    </CollapsibleTrigger>
  );
}

function useSection(defaultOpen = true) {
  const [open, setOpen] = useState(defaultOpen);
  return { open, toggle: () => setOpen((v) => !v) };
}

export function ContactViewDrawer({ open, onOpenChange, contact }: ContactViewDrawerProps) {
  const pessoal = useSection(true);
  const endereco = useSection(true);
  const redes = useSection(true);
  const etiquetas = useSection(true);
  const obs = useSection(true);
  const sistema = useSection(true);

  if (!contact) return null;

  const fmt = (date?: string | null) =>
    date ? new Date(date).toLocaleDateString("pt-BR") : null;

  const val = (v: string | number | boolean | null | undefined): React.ReactNode => {
    if (v === null || v === undefined || v === "") return <EmptyValue />;
    if (typeof v === "boolean") return v ? "Sim" : "Nao";
    return String(v);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2 flex-wrap">
            {contact.is_favorite && (
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 shrink-0" />
            )}
            {contact.declarou_voto && (
              <Badge variant="secondary" className="text-xs">
                Declarou Voto
              </Badge>
            )}
          </div>
          <SheetTitle className="text-left leading-snug mt-1">{getContactDisplayName(contact)}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-1">

            {/* Dados Pessoais */}
            <Collapsible open={pessoal.open}>
              <SectionHeader title="Dados Pessoais" open={pessoal.open} onToggle={pessoal.toggle} />
              <CollapsibleContent>
                <div className="pb-2 space-y-0.5">
                  <FieldRow label="Nome" value={val(getContactDisplayName(contact))} />
                  <FieldRow
                    label="WhatsApp"
                    value={
                      contact.whatsapp ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {contact.whatsapp}
                        </span>
                      ) : (
                        <EmptyValue />
                      )
                    }
                  />
                  <FieldRow
                    label="E-mail"
                    value={
                      contact.email ? (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </span>
                      ) : (
                        <EmptyValue />
                      )
                    }
                  />
                  <FieldRow label="Telefone" value={val(contact.telefone)} />
                  <FieldRow label="Gênero" value={val(contact.genero)} />
                  <FieldRow label="Origem" value={val(contact.origem)} />
                  <FieldRow
                    label="Data de Nascimento"
                    value={fmt(contact.data_nascimento) ?? <EmptyValue />}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Endereço */}
            <Collapsible open={endereco.open}>
              <SectionHeader title="Endereço" open={endereco.open} onToggle={endereco.toggle} />
              <CollapsibleContent>
                <div className="pb-2 space-y-0.5">
                  <FieldRow
                    label="Logradouro"
                    value={
                      contact.logradouro ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {contact.logradouro}
                        </span>
                      ) : (
                        <EmptyValue />
                      )
                    }
                  />
                  <FieldRow label="Número" value={val(contact.numero)} />
                  <FieldRow label="Complemento" value={val(contact.complemento)} />
                  <FieldRow label="Bairro" value={val(contact.bairro)} />
                  <FieldRow label="Cidade" value={val(contact.cidade)} />
                  <FieldRow label="Estado" value={val(contact.estado)} />
                  <FieldRow label="CEP" value={val(contact.cep)} />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Redes Sociais */}
            <Collapsible open={redes.open}>
              <SectionHeader title="Redes Sociais" open={redes.open} onToggle={redes.toggle} />
              <CollapsibleContent>
                <div className="pb-2 space-y-0.5">
                  <FieldRow
                    label="Instagram"
                    value={
                      contact.instagram ? (
                        <span className="flex items-center gap-1">
                          <Instagram className="h-3 w-3" />
                          {contact.instagram}
                        </span>
                      ) : (
                        <EmptyValue />
                      )
                    }
                  />
                  <FieldRow
                    label="Twitter"
                    value={
                      contact.twitter ? (
                        <span className="flex items-center gap-1">
                          <Twitter className="h-3 w-3" />
                          {contact.twitter}
                        </span>
                      ) : (
                        <EmptyValue />
                      )
                    }
                  />
                  <FieldRow label="TikTok" value={val(contact.tiktok)} />
                  <FieldRow label="YouTube" value={val(contact.youtube)} />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Etiquetas */}
            <Collapsible open={etiquetas.open}>
              <SectionHeader title="Etiquetas" open={etiquetas.open} onToggle={etiquetas.toggle} />
              <CollapsibleContent>
                <div className="pb-2 pt-1">
                  {contact.contact_tags && contact.contact_tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {contact.contact_tags.map((ct) => (
                        <Badge
                          key={ct.tags.id}
                          style={
                            ct.tags.cor
                              ? { backgroundColor: ct.tags.cor, color: "#fff" }
                              : undefined
                          }
                          variant="secondary"
                          className="text-xs"
                        >
                          {ct.tags.nome}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <EmptyValue />
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Observações */}
            <Collapsible open={obs.open}>
              <SectionHeader title="Observações" open={obs.open} onToggle={obs.toggle} />
              <CollapsibleContent>
                <div className="pb-2 space-y-0.5">
                  <FieldRow label="Observações" value={val(contact.observacoes)} />
                  <FieldRow label="Notas do Assessor" value={val(contact.notas_assessor)} />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Info do Sistema */}
            <Collapsible open={sistema.open}>
              <SectionHeader title="Info do Sistema" open={sistema.open} onToggle={sistema.toggle} />
              <CollapsibleContent>
                <div className="pb-2 space-y-0.5">
                  <FieldRow
                    label="ID"
                    value={
                      <span className="font-mono text-xs text-muted-foreground">
                        {contact.id.slice(0, 8)}…{contact.id.slice(-4)}
                      </span>
                    }
                  />
                  <FieldRow
                    label="Criado em"
                    value={fmt(contact.created_at) ?? <EmptyValue />}
                  />
                  <FieldRow
                    label="Atualizado em"
                    value={fmt(contact.updated_at) ?? <EmptyValue />}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
