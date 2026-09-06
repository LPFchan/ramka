/**
 * The layout is what makes the parallel-route slot exist: `@modal` renders as
 * the `modal` prop NEXT TO the page, not inside it. During soft navigation to
 * `photos/[id]` the interception route fills this slot with the lightbox while
 * `children` keeps showing the grid the user was on; on hard loads the slot
 * renders `@modal/default.tsx` (null) and `children` is the standalone photo
 * page.
 */
export default function InterceptedRoutesLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
