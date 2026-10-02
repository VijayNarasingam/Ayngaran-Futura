import { useMemo } from 'react'
import { ResourcePage } from '../components/ResourcePage.jsx'
import { bookingsResource } from '../resources/bookings.jsx'
import { useStore } from '../context/StoreContext.jsx'

export default function PlotBooking() {
  const { data } = useStore()
  const resource = useMemo(() => bookingsResource(data), [data])
  return <ResourcePage resource={resource} />
}
