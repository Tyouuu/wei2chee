import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations("hero");
  return <h1>{t("headline")}</h1>;
}
