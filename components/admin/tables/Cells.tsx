"use client";

import { DefaultCell, useListDrawerContext } from "@payloadcms/ui";
import type { DefaultCellComponentProps } from "payload";
import { adminPostStatus } from "@/lib/admin-post-status";

export function TitleCell(props: DefaultCellComponentProps) {
  const { isInDrawer, onSelect } = useListDrawerContext();
  const drawerProps = isInDrawer && props.link && onSelect ? {
    link: false,
    onClick: () => onSelect({ collectionSlug: props.collectionSlug, doc: props.rowData, docID: props.rowData.id }),
  } : {};
  return (
    <div className="admin-table-title">
      <DefaultCell {...props} {...drawerProps} />
      {typeof props.rowData.description === "string" && <span className="admin-table-title__description">{props.rowData.description}</span>}
    </div>
  );
}

export function PostStatusCell({ cellData, rowData }: DefaultCellComponentProps) {
  const status = adminPostStatus(cellData, rowData.visibility);
  return <span className={`admin-table-status admin-table-status--${status.tone}`}>{status.label}</span>;
}

export function PublicationCell({ cellData }: DefaultCellComponentProps) {
  const date = typeof cellData === "string" ? new Date(cellData) : null;
  if (!date || Number.isNaN(date.getTime())) return <span>—</span>;
  return <time dateTime={date.toISOString()}>{new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", day: "2-digit", month: "2-digit", year: "numeric" }).format(date)}</time>;
}
