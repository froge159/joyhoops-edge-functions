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
    const {class_id, user_id, child_id} = body;
    

    try {
        // refund the user
		const {data: charge_data, error: charge_error} = await supabase
			.from("Class_User_Child")
			.select("charge_id")
			.eq("class_id", class_id)
			.eq("user_id", user_id)
			.eq("child_id", child_id)
			.single();

		if (charge_error || !charge_data) {
			console.error("Supabase select error:", charge_error);
			return new Response("Error retrieving charge ID from Supabase", { status: 500 });
		}

		const {data: price_data, error: price_error} = await supabase
			.from("Class")
			.select("price")
			.eq("id", class_id)
			.single();

		if (price_error || !price_data) {
			console.error("Supabase select error:", price_error);
			return new Response("Error retrieving class price from Supabase", { status: 500 });
		}
		const price = await stripe.prices.retrieve(price_data.price);

		const refund = await stripe.refunds.create({
			charge: charge_data.charge_id,
			amount: price.unit_amount,
			reason: "requested_by_customer",
		});

        // remove Class_User_Child entry
		const {error} = await supabase
			.from("Class_User_Child")
			.delete()
			.eq("class_id", class_id)
			.eq("user_id", user_id)
			.eq("child_id", child_id);
			
		if (error) {
			console.error("Supabase delete error:", error);
			return new Response("Error deleting class enrollment from Supabase", { status: 500 });
		}

		return new Response(JSON.stringify({ message: 'Refund executed successfully'}), {
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