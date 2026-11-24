'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Download,
  Search,
  Eye,
  Package,
  Filter,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { api } from '@/lib/api';
import { TripDocument, TripDocumentFile } from '@/types';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';

interface DocumentsResponse {
  data: TripDocument[];
  meta?: {
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
  };
}

export default function DocumentsRegisterPage() {
  const { user } = useAuth();
  const canExport = user?.role !== 'driver';

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [previewFile, setPreviewFile] = useState<TripDocumentFile | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery<DocumentsResponse>({
    queryKey: ['documents-register', search, typeFilter, statusFilter, page],
    queryFn: () =>
      api.get<DocumentsResponse>('/documents', {
        search: search || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        page,
        per_page: 25,
      }),
  });

  const documents = data?.data ?? [];
  const meta = data?.meta;

  const handleExport = (format: 'csv' | 'pdf') => {
    if (!canExport) {
      toast.error('Drivers cannot export documents');
      return;
    }
    setExporting(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
      const params = new URLSearchParams({ format });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);

      window.open(`${baseUrl}/documents/export?${params.toString()}`, '_blank');
      toast.success(`Exporting documents register as ${format.toUpperCase()}...`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents Register"
        description="Comprehensive audit register of delivery notes, interchange receipts, and cargo documents"
        breadcrumbs={[
          { label: 'Reports', href: '/reports' },
          { label: 'Documents Register' },
        ]}
        actions={
          canExport && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={exporting}
                onClick={() => handleExport('csv')}
              >
                <Download className="h-3.5 w-3.5 mr-1" /> CSV Export
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={exporting}
                onClick={() => handleExport('pdf')}
              >
                <Download className="h-3.5 w-3.5 mr-1" /> PDF Export
              </Button>
            </div>
          )
        }
      />

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
            <div className="relative flex-1 w-full sm:min-w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search document #, container #, seal #..."
                className="pl-9 w-full text-xs"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 rounded-lg border border-input bg-card text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
            >
              <option value="">All Document Types</option>
              <option value="delivery_note">Delivery Note (DN)</option>
              <option value="container_interchange">Container Interchange (EIR)</option>
              <option value="waybill">Waybill</option>
              <option value="weighbridge_ticket">Weighbridge Ticket</option>
              <option value="proof_of_delivery">Proof of Delivery</option>
              <option value="customs_release">Customs Release</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 rounded-lg border border-input bg-card text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="verified">Verified</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Summary strip */}
      {meta && (
        <div className="text-xs text-muted-foreground px-1 flex items-center justify-between">
          <span>
            Showing <strong className="text-foreground">{documents.length}</strong> of{' '}
            <strong className="text-foreground">{meta.total}</strong> documents across the fleet
          </span>
          {meta.last_page > 1 && (
            <span>
              Page {meta.current_page} of {meta.last_page}
            </span>
          )}
        </div>
      )}

      {/* Register Table */}
      <Card>
        <CardContent className="p-0">
          {/* Mobile Document Cards View */}
          <div className="block sm:hidden divide-y divide-border">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Loading documents...</div>
            ) : documents.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground p-4">
                <FileText className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="font-medium text-foreground">No documents found</p>
                <p className="text-xs mt-1">Try adjusting your search or filters.</p>
              </div>
            ) : (
              documents.map((doc) => {
                const isEir = doc.type === 'container_interchange';
                const hasFiles = doc.files && doc.files.length > 0;

                return (
                  <div key={doc.id} className="p-4 space-y-2.5 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {isEir ? <Package className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                          {isEir ? 'EIR' : 'DN'}
                        </span>
                        <span className="font-mono font-semibold text-foreground text-sm">
                          {doc.document_number}
                        </span>
                      </div>
                      <StatusBadge status={doc.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Trip Ref</span>
                        {doc.trip ? (
                          <Link href={`/trips/${doc.trip_id}`} className="text-primary hover:underline font-mono font-medium">
                            {doc.trip.reference}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Trip #{doc.trip_id}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Issued Date</span>
                        <span className="text-foreground">{doc.issued_date}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Truck / Driver</span>
                        <span className="font-mono text-foreground font-medium">{doc.trip?.truck?.reg_number ?? '—'}</span>
                        <span className="text-muted-foreground block truncate">{doc.trip?.driver?.name ?? '—'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Container #</span>
                        <span className="font-mono text-foreground">{doc.container_number || '—'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <div>
                        {hasFiles ? (
                          <span className="inline-flex items-center gap-1 font-medium text-xs text-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            {doc.files!.length} {doc.files!.length === 1 ? 'file' : 'files'}
                          </span>
                        ) : (
                          <span className="text-destructive font-medium text-xs">Missing file</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {hasFiles && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setPreviewFile(doc.files![0])}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Preview
                          </Button>
                        )}
                        <Link href={`/trips/${doc.trip_id}`}>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                            View Trip
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm min-w-[850px]">
              <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                <tr>
                  <th className="py-2.5 px-4 text-left font-medium">Type</th>
                  <th className="py-2.5 px-4 text-left font-medium">Document #</th>
                  <th className="py-2.5 px-4 text-left font-medium">Issued Date</th>
                  <th className="py-2.5 px-4 text-left font-medium">Status</th>
                  <th className="py-2.5 px-4 text-left font-medium">Trip Ref</th>
                  <th className="py-2.5 px-4 text-left font-medium">Truck</th>
                  <th className="py-2.5 px-4 text-left font-medium">Driver</th>
                  <th className="py-2.5 px-4 text-left font-medium">Container #</th>
                  <th className="py-2.5 px-4 text-left font-medium">Files</th>
                  <th className="py-2.5 px-4 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="py-3 px-4">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-xs text-muted-foreground">
                      <FileText className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      <p className="font-medium text-foreground">No documents found</p>
                      <p className="text-xs mt-1">Try adjusting your search or filters.</p>
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => {
                    const isEir = doc.type === 'container_interchange';
                    const hasFiles = doc.files && doc.files.length > 0;

                    return (
                      <tr key={doc.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            {isEir ? <Package className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                            {isEir ? 'EIR' : 'DN'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-foreground">
                          {doc.document_number}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">{doc.issued_date}</td>
                        <td className="py-3 px-4">
                          <StatusBadge status={doc.status} />
                        </td>
                        <td className="py-3 px-4">
                          {doc.trip ? (
                            <Link
                              href={`/trips/${doc.trip_id}`}
                              className="text-primary hover:underline font-mono text-xs font-semibold"
                            >
                              {doc.trip.reference}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-xs">Trip #{doc.trip_id}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-foreground">
                          {doc.trip?.truck?.reg_number ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {doc.trip?.driver?.name ?? '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-foreground">
                          {doc.container_number ? (
                            <span>{doc.container_number}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {hasFiles ? (
                            <span className="inline-flex items-center gap-1 font-medium text-foreground">
                              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              {doc.files!.length} {doc.files!.length === 1 ? 'file' : 'files'}
                            </span>
                          ) : (
                            <span className="text-destructive font-medium">Missing file</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {hasFiles && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => setPreviewFile(doc.files![0])}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                Preview
                              </Button>
                            )}
                            <Link href={`/trips/${doc.trip_id}`}>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                                View Trip
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {meta && meta.last_page > 1 && (
        <div className="flex justify-center items-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="px-3 py-1 text-xs text-muted-foreground">
            Page {meta.current_page} of {meta.last_page}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= meta.last_page}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Scanned Document Preview Modal */}
      <Dialog open={previewFile !== null} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewFile?.original_name}</DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="max-h-[70vh] overflow-auto">
              {previewFile.mime_type?.startsWith('image/') ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewFile.download_url}
                  alt={previewFile.original_name}
                  className="w-full rounded-lg object-contain max-h-[60vh]"
                />
              ) : (
                <iframe
                  src={previewFile.download_url}
                  className="w-full h-[60vh] rounded-lg border border-border"
                  title={previewFile.original_name}
                />
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewFile(null)}>
              Close
            </Button>
            <a href={previewFile?.download_url} download target="_blank" rel="noreferrer">
              <Button>Download Original</Button>
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
