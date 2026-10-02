import { useMemo } from 'react'
import { ResourcePage } from '../components/ResourcePage.jsx'
import { loansResource } from '../resources/loans.jsx'
import { useStore } from '../context/StoreContext.jsx'

export default function Loans() {
  const { data } = useStore()
  const resource = useMemo(() => loansResource(data), [data])
  return <ResourcePage resource={resource} />
}
