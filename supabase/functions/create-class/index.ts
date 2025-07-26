import Stripe from "https://esm.sh/stripe?target=deno";
import {createClient} from "https://esm.sh/v2/@supabase/supabase-js@2.0.0";

Deno.serve( async (req: Request) => {

    const stripe = Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "");
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let body;
	try {
		body = await req.json();
	} catch (err) {
		const errorMessage = (err instanceof Error) ? err.message : String(err);
		return new Response(JSON.stringify({ error: errorMessage }), {
			status: 400,
			headers: {'Content-Type': 'application/json' },
		});
	}
    const {start_datetime, end_datetime, location, name, description,
        volunteer_hours, active, price} = body;
    

    try {
        const product = await stripe.products.create({
            name,
            description,
            active
        });

        const stripePrice = await stripe.prices.create({
            product: product.id, 
            unit_amount: price * 100,
            currency: "usd",
        });

        const { error } = await supabase.from("Class").insert({
            start_datetime: new Date(start_datetime),
            end_datetime: new Date(end_datetime),
            location,
            name,
            description,
            volunteer_hours,
            active,
            price: stripePrice.id,
            product_id: product.id
        });

        if (error) {
            console.error("Supabase insert error:", error);
            return new Response("Error inserting class into Supabase", { status: 500 });
        }

        return new Response(
            JSON.stringify({ message: "Class created", product_id: product.id }),
            { headers: {"Content-Type": "application/json"}, status: 201 }
        );
    }

    catch (err) {
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        return new Response(
            JSON.stringify({ error: errorMessage }),
            {headers: {"Content-Type": "application/json"}, status: 500 }
        );
    }

});