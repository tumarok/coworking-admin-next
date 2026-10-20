export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-sidebar to-primary p-4">
      {children}
    </main>
  );
}
