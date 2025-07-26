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
    } 
	catch (err) {
		const errorMessage = (err instanceof Error) ? err.message : String(err);
		return new Response(JSON.stringify({ error: errorMessage }), {
			status: 400,
			headers: {'Content-Type': 'application/json' },
		});
    }
    const {class_id, user_id, children} = body;
    

    try {
		const {data: price_data, error: price_error} = await supabase
			.from("Class")
			.select("price")
			.eq("id", class_id)
			.single();

		if (price_error || !price_data) {
			console.error("Supabase select error:", price_error);
			return new Response("Error retrieving class price from Supabase", { status: 500 });
		}


		const session = await stripe.checkout.sessions.create({
			// CHANGE THIS LATER
			success_url: `${Deno.env.get("FRONTEND_URL")}/enrollment/success`, 
			return_url: `${Deno.env.get("FRONTEND_URL")}/enrollment/cancel`,
			// CHANGE THIS LATER
			mode: "payment",
			line_items: [{
				price: price_data.price,
				quantity: children.length,
			}],
			currency: "usd",
			metadata: {
				class_id,
				user_id,
				children: children.join(","),
			},
		})


		return new Response(JSON.stringify({ message: 'Checkout session created successfully'}), {
			status: 200,
			headers: {'Content-Type': 'application/json' },
		});
    }

    catch (err) {
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        return new Response(
            JSON.stringify({ error: errorMessage }),
            {headers: {"Content-Type": "application/json"}, status: 500 }
        );
    }

});