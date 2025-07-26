import Stripe from "https://esm.sh/stripe?target=deno";
import {createClient} from "https://esm.sh/v2/@supabase/supabase-js@2.0.0";

Deno.serve(async (req) => {
	const stripe = Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
	const supabase = createClient(
		Deno.env.get("SUPABASE_URL")!,
		Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
	);

	const sig = req.headers.get("stripe-signature")!;
	const rawBody = await req.text();

	let event;
	try {
		event = stripe.webhooks.constructEvent(
			rawBody,
			sig,
			Deno.env.get("STRIPE_WEBHOOK_SECRET")!
		);
	} catch (err) {
		const errorMessage = (err instanceof Error) ? err.message : String(err);
		return new Response(`Webhook signature verification failed: ${errorMessage}`, {
			status: 400,
		});
	}

	

	if (event.type === "checkout.session.completed") {
		const session = event.data.object;
		const paymentIntentId = session.payment_intent as string;

		const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
			expand: ["charges"],
		});

		const chargeId = paymentIntent.charges.data[0].id;
		if (!chargeId) {
    		return new Response("No charge found on payment intent", { status: 500 });
		}
		
		const {class_id, user_id, children} = session.metadata;

		for (const child_id of children.split(",")) {
			const {error} = await supabase.from("Class_User_Child").insert({
				class_id,
				user_id,
				child_id,
				charge_id: chargeId,
			});

			if (error) {
				console.error("Supabase insert error:", error);
				return new Response("Error inserting class enrollment into Supabase", { status: 500 });
			}
		}

		return new Response(JSON.stringify({ message: "Enrollment successful - user charged"}));

	}

	return new Response("Event ignored", { status: 200 });
});
