"use client"

import * as React from "react"

type BreadcrumbLabelMap = Record<string, string>

type BreadcrumbLabelsContextValue = {
  labels: BreadcrumbLabelMap
  setLabels: React.Dispatch<React.SetStateAction<BreadcrumbLabelMap>>
}

const BreadcrumbLabelsContext = React.createContext<
  BreadcrumbLabelsContextValue | undefined
>(undefined)

export function BreadcrumbLabelsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [labels, setLabels] = React.useState<BreadcrumbLabelMap>({})

  const value = React.useMemo(() => ({ labels, setLabels }), [labels])

  return (
    <BreadcrumbLabelsContext.Provider value={value}>
      {children}
    </BreadcrumbLabelsContext.Provider>
  )
}

export function BreadcrumbLabels({ labels }: { labels: BreadcrumbLabelMap }) {
  const context = React.useContext(BreadcrumbLabelsContext)

  if (!context) {
    return null
  }

  const { setLabels } = context

  React.useEffect(() => {
    setLabels(labels)

    return () => {
      setLabels({})
    }
  }, [labels, setLabels])

  return null
}

export function useBreadcrumbLabels() {
  const context = React.useContext(BreadcrumbLabelsContext)

  if (!context) {
    return { labels: {} as BreadcrumbLabelMap }
  }

  return context
}
