import { useMemo } from 'react'
import { ResourcePage } from '../components/ResourcePage.jsx'
import { marketersResource } from '../resources/marketers.jsx'
import { useStore } from '../context/StoreContext.jsx'

export default function Marketers() {
  const { data } = useStore()
  const resource = useMemo(() => marketersResource(data), [data])
  return <ResourcePage resource={resource} />
}
