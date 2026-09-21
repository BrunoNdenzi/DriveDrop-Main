import { redirect } from 'next/navigation'

export default function RoutePlannerSignupPage() {
  redirect('/signup?role=client&product=route-planner')
}