import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateOrganizationForm } from "@/components/organizations/create-organization-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "New organization · Smart Inventory" };

export default async function NewOrganizationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/organizations/new");
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Create an organization</CardTitle>
          <CardDescription>
            Every product, warehouse and order belongs to an organization. You
            can invite your team once it exists.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <CreateOrganizationForm />
        </CardContent>

        <CardFooter>
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard" className="underline underline-offset-4">
              Back to dashboard
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
