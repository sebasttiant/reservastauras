import { PublicReservationPage } from "@/app/public-reservation-page";

interface HomePageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  return <PublicReservationPage searchParams={params} />;
}
