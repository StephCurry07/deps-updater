'use client'

import { useState, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Copy, Loader2, StopCircle } from "lucide-react"
import toast, { Toaster } from 'react-hot-toast'

type LanguageType = 'python' | 'node' | 'flutter' | 'ruby' | 'php' | 'java' | 'dotnet' | 'rust' | 'go' | 'r' | 'unknown'

export default function Component() {
  const [dependencies, setDependencies] = useState('')
  const [output, setOutput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState<LanguageType>('unknown')
  const abortControllerRef = useRef<AbortController | null>(null)

  const detectLanguage = (input: string): LanguageType => {
    if (input.includes('<dependencies>')) return 'java'
    if (input.includes('<packages>') || input.includes('<PackageReference')) return 'dotnet'
    if (input.includes('dependencies:') && input.includes('flutter:')) return 'flutter'
    if (input.includes("source 'https://rubygems.org'") || input.includes('gem ')) return 'ruby'
    if (input.includes('[dependencies]')) return 'rust'
    if (input.includes('"dependencies":') || input.includes('"devDependencies":')) return 'node'
    if (input.includes('"require":') || input.includes('"require-dev":')) return 'php'
    if (input.includes('install.packages(')) return 'r'
    if (input.includes('require (') && input.includes('module')) return 'go'
    if (input.split('\n').some(line => line.trim().match(/^[a-zA-Z0-9_-]+==?[0-9.]+$/))) return 'python'
    return 'unknown'
  }

  const fetchLatestVersion = async (packageName: string, type: LanguageType) => {
    try {
      let url: string
      // const [groupId, artifactId] = packageName.split(':') || [];
      switch (type) {
        case 'java':
          // const [groupId, artifactId] = packageName.split(':');
          url = `https://libraries.io/api/maven/${packageName}?api_key=6b4f52d33a0c9659d30b3cee1645487f`;
          break;
        case 'python':
          url = `https://pypi.org/pypi/${packageName}/json`
          break
        case 'node':
          url = `https://registry.npmjs.org/${packageName}/latest`
          break
        case 'flutter':
          url = `https://pub.dev/api/packages/${packageName}`
          break
        case 'ruby':
          url = `https://rubygems.org/api/v1/versions/${packageName}.json`
          break
        case 'php':
          url = `https://repo.packagist.org/p2/${packageName}.json`
          break
        case 'dotnet':
          url = `https://api.nuget.org/v3/registration5-semver1/${packageName}/index.json`
          break
        case 'rust':
          url = `https://crates.io/api/v1/crates/${packageName}`
          break
        case 'go':
        case 'r':
          return 'latest'
        default:
          throw new Error('Unsupported language')
      }
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      
      switch (type) {
        case 'java':
          return data.latest_release_number
        case 'python':
          return data.info.version
        case 'node':
          return data.version
        case 'flutter':
          return data.latest.version
        case 'ruby':
          return data[0].number
        case 'php':
          const versions = data.packages[packageName.toLowerCase()] || {}
          return Object.keys(versions).sort((a, b) => 
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
          ).pop() || 'unknown'
        case 'dotnet':
          return data.items[0].upper
        case 'rust':
          return data.crate.max_version
        case 'go':
        case 'r':
          return 'latest'
        default:
          throw new Error('Unsupported language')
      }
    } catch (error) {
      console.error(`Error fetching version for ${packageName}:`, error)
      return 'unknown'
    }
  }

  const extractDependencies = (input: string, type: LanguageType): string[] => {
    switch (type) {
      case 'java':
        return input.split('<dependency>')
          .slice(1)
          .map(dep => {
            const groupId = dep.match(/<groupId>(.*?)<\/groupId>/)?.[1]
            const artifactId = dep.match(/<artifactId>(.*?)<\/artifactId>/)?.[1]
            return groupId && artifactId ? `${groupId}:${artifactId}` : null
          })
          .filter(Boolean) as string[]
      case 'python':
        return input.split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
            if (line.includes('==')) {
                return line.split('==')[0];
            } else {
                return line;
            }
        });
        // console.log(input.split('\n').filter(line => line.includes('==')))
        // return input.split('\n').filter(line => line.includes('=='))
      case 'node':
        const json = JSON.parse(input)
        return Object.keys(json.dependencies || {}).concat('-devdeps-', Object.keys(json.devDependencies || {}))
      case 'flutter':
        return input.split('\n')
          .filter(line => line.includes(':') && !line.includes('sdk:'))
          .map(line => line.split(':')[0].trim())
      case 'ruby':
        return input.split('\n')
          .filter(line => line.startsWith('gem '))
          .map(line => line.split("'")[1] || line.split('"')[1])
      case 'php':
        const phpJson = JSON.parse(input)
        return Object.keys(phpJson.require || {}).concat(Object.keys(phpJson['require-dev'] || {}))
      case 'dotnet':
        return input.split('\n')
          .filter(line => line.includes('<PackageReference'))
          .map(line => line.match(/Include="(.*?)"/)?.[1])
          .filter(Boolean) as string[]
      case 'rust':
        return input.split('\n')
          .filter(line => line.includes('='))
          .map(line => line.split('=')[0].trim())
      case 'go':
        return input.split('\n')
          .filter(line => line.startsWith('import') && line.includes('"'))
          .map(line => line.split('"')[1].split('/').pop())
          .filter(Boolean) as string[]
      case 'r':
        return input.split('\n')
          .filter(line => line.includes('install.packages('))
          .map(line => line.match(/install\.packages\("(.*?)"/)?.[1])
          .filter(Boolean) as string[]
      default:
        return []
    }
  }

  const formatOutput = (deps: { [key: string]: string }, type: LanguageType) => {
    switch (type) {
      case 'java':
        return `<dependencies>\n${Object.entries(deps).map(([name, version]) => {
          const [groupId, artifactId] = name.split(':')
          return `  <dependency>\n    <groupId>${groupId}</groupId>\n    <artifactId>${artifactId}</artifactId>\n    <version>${version}</version>\n  </dependency>`
        }).join('\n')}\n</dependencies>`
      case 'python':
        return Object.entries(deps).map(([name, version]) => `${name}==${version}`).join('\n')
      case 'node':
        let regularDeps: { [key: string]: string } = {}
        let devDeps: { [key: string]: string } = {}
        let flag = 0
        Object.keys(deps).forEach(dep => {
          if (flag == 0){
            if (dep.startsWith('-devdeps-')) {
              const cleanName = dep.replace('-devdeps-', '')
              flag = 1
            }
            else{
              regularDeps[dep] = deps[dep]
            }
          } else {
            devDeps[dep] = deps[dep]
          }
        })
        return JSON.stringify({
          dependencies: regularDeps,
          devDependencies: devDeps,
        }, null, 2)

      case 'flutter':
        return `dependencies:\n${Object.entries(deps).map(([name, version]) => `  ${name}: ^${version}`).join('\n')}`
      case 'ruby':
        return `source 'https://rubygems.org'\n\n${Object.entries(deps).map(([name, version]) => `gem '${name}', '${version}'`).join('\n')}`
      case 'php':
        return JSON.stringify({ require: deps }, null, 2)
      case 'dotnet':
        return Object.entries(deps).map(([name, version]) => `<PackageReference Include="${name}" Version="${version}" />`).join('\n')
      case 'rust':
        return '[dependencies]\n' + Object.entries(deps).map(([name, version]) => `${name} = "${version}"`).join('\n')
      case 'go':
        return Object.entries(deps).map(([name, version]) => `import "${name}"`).join('\n')
      case 'r':
        return Object.entries(deps).map(([name, version]) => `install.packages("${name}", version = "${version}")`).join('\n')
      default:
        return 'Unsupported language'
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setOutput('')
    const language = detectLanguage(dependencies)
    setDetectedLanguage(language)
    
    if (language === 'unknown') {
      setOutput('Unable to detect language. Please check your input.')
      setIsLoading(false)
      return
    }

    const depList = extractDependencies(dependencies, language)
    const latestDeps: { [key: string]: string } = {}

    abortControllerRef.current = new AbortController()

    try {
      for (const dep of depList) {
        if (abortControllerRef.current.signal.aborted) {
          throw new Error('Operation cancelled')
        }

        const packageName = dep.trim()
        if (packageName === '-devdeps-'){
          latestDeps[packageName] = 'splithere'
          continue
        }
        const version = await fetchLatestVersion(packageName, language)
        latestDeps[packageName] = version

        // Update output in real-time
        setOutput(prevOutput => {
          const newOutput = { ...JSON.parse(prevOutput || '{}'), [packageName]: version }
          return JSON.stringify(newOutput, null, 2)
        })
      }

      const formattedOutput = formatOutput(latestDeps, language)
      setOutput(formattedOutput)
    } catch (error) {
      if (error.message !== 'Operation cancelled') {
        console.error('Error updating dependencies:', error)
        toast.error('An error occurred while updating dependencies')
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
      toast.success('Operation stopped')
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output)
    toast.success('Copied to clipboard!')
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-center">Advanced Dependency Version Updater</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="dependencies">Paste your dependency file contents here</Label>
          <Textarea
            id="dependencies"
            value={dependencies}
            onChange={(e) => setDependencies(e.target.value)}
            placeholder="Paste the contents of your dependency file (e.g., pom.xml, package.json, requirements.txt, etc.)"
            className="mt-1"
            rows={10}
          />
        </div>
        <div className="flex space-x-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching latest versions...
              </>
            ) : (
              'Get Latest Versions'
            )}
          </Button>
          {isLoading && (
            <Button type="button" onClick={handleStop} variant="destructive">
              <StopCircle className="mr-2 h-4 w-4" />
              Stop
            </Button>
          )}
        </div>
      </form>
      {output && (
        <div className="space-y-2">
          <Label htmlFor="output">
            Latest Dependencies 
            {detectedLanguage !== 'unknown' && (
              <span className="ml-2 text-sm text-muted-foreground">
                (Detected: {detectedLanguage})
              </span>
            )}
          </Label>
          <div className="relative">
            <Textarea
              id="output"
              value={output}
              readOnly
              className="mt-1 font-mono"
              rows={10}
            />
            <Button
              size="icon"
              variant="outline"
              className="absolute top-2 right-2"
              onClick={copyToClipboard}
              aria-label="Copy to clipboard"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <Toaster />
    </div>
  )
}