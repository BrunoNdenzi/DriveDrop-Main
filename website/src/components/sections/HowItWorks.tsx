export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How It Works</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Ship your vehicle in three simple steps
          </p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
              1
            </div>
            <h3 className="mt-4 font-semibold">Get a Quote</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your pickup and delivery locations to get an instant price estimate
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
              2
            </div>
            <h3 className="mt-4 font-semibold">Book via App</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Download our mobile app, create your shipment, and make the initial payment
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
              3
            </div>
            <h3 className="mt-4 font-semibold">Track & Receive</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Track your vehicle in real-time and receive it at your destination
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
