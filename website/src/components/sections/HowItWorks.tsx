export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-12 bg-muted/30">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How It Works</h2>
          <p className="mt-3 text-base text-muted-foreground">
            Ship your vehicle in three simple steps
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xl">
              1
            </div>
            <h3 className="mt-4 font-bold text-base">Get a Quote</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Enter your pickup and delivery locations to get an instant price estimate
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xl">
              2
            </div>
            <h3 className="mt-4 font-bold text-base">Book via App</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Download our mobile app, create your shipment, and make the initial payment
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xl">
              3
            </div>
            <h3 className="mt-4 font-bold text-base">Track & Receive</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Track your vehicle in real-time and receive it at your destination
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
