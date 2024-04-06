import { AikenAlgVal, AikenConstructor, AikenDataVal, AikenDefinitions, AikenField, AikenParam, AikenPrimVal, AikenVal } from "../types/aiken"
import { DruidVal, DruidDataVal, DruidBytesVal, DruidIntVal, DruidAlgVal, DruidConstructor, DruidPrimVal } from "../types/druid"
import { PlutusDataVal, PlutusVal, PlutusBytesVal, PlutusIntVal } from "../types/plutus"
import { v4 as uuidv4 } from 'uuid'

export interface DruidArgs {
  datum?: DruidArg
  parameters?: DruidArg[]
  redeemer: DruidArg
}

export type DruidArg = InputField | DropdownField | DropdownOption

export class ArgTree_ {
  uuid: string
  label: string
  children: DruidArg[]

  constructor(druidVal: DruidVal | DruidConstructor) {
    this.uuid = druidVal.uuid
    this.label = druidVal.label
    this.children = []
  }

  getChildById(uuid: string): DruidArg {
    for (const child of this.children) {
      if (child.uuid === uuid) {
        return child
      }
      const nestedChild = child.getChildById(uuid)
      if (nestedChild) {
        return nestedChild
      }
    }
    throw new Error("Invalid UUID")
  }
}

export type InputField = BytesField | DataField | IntField

export class BytesField extends ArgTree_ {
  hintText: string
  plutusValue: PlutusBytesVal
  constructor(druidVal: DruidBytesVal) {
    super(druidVal)
    this.hintText = "bytes"
    this.plutusValue = { "bytes": druidVal.bytes }
  }
  showFieldVal(): string {
    return this.plutusValue.bytes
  }
  setFieldVal(newVal: string): void {
    this.plutusValue.bytes = newVal
  }
  toPlutusVal(): PlutusBytesVal {
    return this.plutusValue
  }
}

export class IntField extends ArgTree_ {
  hintText: string
  plutusValue: PlutusIntVal
  constructor(druidVal: DruidIntVal) {
    super(druidVal)
    this.hintText = "int"
    this.plutusValue = { "int": druidVal.int }
  }
  showFieldVal(): string {
    return this.plutusValue.int.toString()
  }
  setFieldVal(newVal: string): void {
    this.plutusValue.int = parseInt(newVal, 10)
  }
  toPlutusVal(): PlutusIntVal {
    return this.plutusValue
  }
}

export class DataField extends ArgTree_ {
  hintText: string
  fieldValue: string
  plutusValue: PlutusDataVal | undefined
  validData: boolean
  constructor(druidVal: DruidDataVal) {
    super(druidVal)
    this.hintText = "data"
    const parsed = JSON.parse(druidVal.data)
    if (parsed) {
      this.plutusValue = parsed
      this.validData = true
    } else {
      this.plutusValue = undefined
      this.validData = false
    }
    this.fieldValue = JSON.stringify(parsed, null, 2)
  }
  showFieldVal(): string {
    return this.fieldValue
  }
  setFieldVal(newVal: string) {
    const parsed: PlutusDataVal = JSON.parse(newVal)
    if (parsed) {
      this.plutusValue = parsed
      this.fieldValue = JSON.stringify(parsed, null, 2)
      this.validData = true
    } else {
      this.validData = false
      this.fieldValue = newVal
    }
  }
  toPlutusVal(): PlutusDataVal {
    const pVal = this.plutusValue
    if (pVal) {
      return pVal
    }
    throw new Error("Invalid Plutus data value: please correct the form entry")
  }
}

export class DropdownField extends ArgTree_ {
  selection: string

  constructor(druidVal: DruidAlgVal) {
    super(druidVal)
    this.selection = druidVal.constructors[0].uuid
    this.children = druidVal.constructors.map(druidValToArg)
  }

  toPlutusVal(): PlutusVal {
    const child = this.getChildById(this.selection) 
    if (child) {
      return child.toPlutusVal()
    }
    throw new Error("Invalid selection UUID")
  }
  setFieldVal(selection: string): void {
    this.selection = selection
  }
}

export class DropdownOption extends ArgTree_ {
  index: number

  constructor(druidVal: DruidConstructor) {
    super(druidVal)
    this.index = druidVal.constructor
    this.children = druidVal.fields.map(druidValToArg)
  }

  toPlutusVal(): PlutusVal {
    return {
      "constructor": this.index,
      "fields": this.children.map((arg: DruidArg) => arg.toPlutusVal())
    }
  }
}

export function isDruidDataVal(druidVal: DruidVal): druidVal is DruidDataVal {
  return (druidVal as DruidDataVal)?.data !== undefined
}

export function isDruidBytesVal(druidVal: DruidVal): druidVal is DruidBytesVal {
  return (druidVal as DruidBytesVal)?.bytes !== undefined
}

export function isDruidIntVal(druidVal: DruidVal): druidVal is DruidIntVal {
  return (druidVal as DruidIntVal)?.int !== undefined
}

export function isDruidAlgVal(druidVal: DruidVal | DruidConstructor): druidVal is DruidAlgVal {
  return (druidVal as DruidAlgVal)?.constructors !== undefined
}

export function isDruidConstr(druidVal: DruidVal | DruidConstructor): druidVal is DruidConstructor {
  return (druidVal as DruidConstructor)?.fields !== undefined
}

function refToDef(refString: string): string {
  const parts = refString.split("/definitions/")
  // Get the last part of the split string
  const lastPart = parts[parts.length - 1]
  // Replace any '~1' with '/'
  return lastPart.replace(/~1/g, "/")
}

function isAikenAlgVal(aikenVal: AikenVal): aikenVal is AikenAlgVal {
  return (aikenVal as AikenAlgVal)?.anyOf !== undefined
}

function aikenAlgToDruidVal(
  definitions: AikenDefinitions,
  label: string,
  algVal: AikenAlgVal,
): DruidAlgVal {
  return {
    constructors: algVal.anyOf.map(aikenToDruidConstructor(definitions)),
    label,
    uuid: uuidv4()
  }
}

function aikenToDruidConstructor(definitions: AikenDefinitions) {
  return function (constr: AikenConstructor): DruidConstructor {
    const constructor = constr.index
    const fields = constr.fields.map(aikenFieldOrParamToDruidVal(definitions))
    return {
      constructor,
      fields,
      label: constr.title ? constr.title : "unknown",
      uuid: uuidv4()
    }
  }
}

function aikenValToDruidVal(definitions: AikenDefinitions, label: string) {
  return function (aikenVal: AikenVal): DruidVal {
    if (isAikenAlgVal(aikenVal)) {
      return aikenAlgToDruidVal(definitions, label, aikenVal)
    } else {
      return isAikenDataVal(aikenVal) ?
        aikenDataToDruidVal(aikenVal) : aikenPrimToDruidVal(label, aikenVal)
    }
  }
}

function druidValToArg(druidVal: DruidVal | DruidConstructor): DruidArg {
  const isConstr = isDruidConstr(druidVal)
  if (isDruidAlgVal(druidVal) && !isConstr) {
    return new DropdownField(druidVal)
  } else if (isConstr) {
    return new DropdownOption(druidVal)
  }
  else if (isDruidBytesVal(druidVal)) {
    return new BytesField(druidVal)
  }
  else if (isDruidIntVal(druidVal)) {
    return new IntField(druidVal)
  }
  else {
    return new DataField(druidVal)
  }
}

function isAikenParam(fieldOrParam: AikenField | AikenParam): fieldOrParam is AikenParam {
  const asParam = fieldOrParam as AikenParam
  return asParam.schema !== undefined
}

export function aikenParamToDruidArg(definitions: AikenDefinitions) {
  return function (aikenParam: AikenParam) {
    const druidVal = aikenFieldOrParamToDruidVal(definitions)(aikenParam)
    return druidValToArg(druidVal)
  }
}

function aikenFieldOrParamToDruidVal(
  definitions: AikenDefinitions,
) {
  return function (fieldOrParam: AikenField | AikenParam) {
    const label = fieldOrParam.title
    const aikenVal = isAikenParam(fieldOrParam) ?
      definitions[refToDef(fieldOrParam.schema.$ref)] :
      definitions[refToDef(fieldOrParam.$ref)]
    return aikenValToDruidVal(definitions, label)(aikenVal)
  }
}

// function isAikenPrimVal(aikenVal: AikenVal): aikenVal is AikenPrimVal {
//   const dataType = (aikenVal as AikenPrimVal)?.dataType
//   return dataType == "bytes" || dataType == "integer"
// }

function aikenPrimToDruidVal(label: string, primType: AikenPrimVal): DruidPrimVal {
  const uuid = uuidv4()
  if (primType?.dataType == "bytes") {
    return { bytes: "", label, uuid }
  }
  return { int: 0, label, uuid }
}

function isAikenDataVal(aikenVal: AikenVal): aikenVal is AikenDataVal {
  const asAnyType = aikenVal as AikenDataVal
  return asAnyType?.title == "Data" && asAnyType?.description == "Any Plutus data."
}

function aikenDataToDruidVal(dataVal: AikenDataVal): DruidDataVal {
  return {
    data: "{}",
    label: dataVal.title,
    uuid: uuidv4()
  }
}

export function deepCopy<T>(list: T[]): T[] {
  return JSON.parse(JSON.stringify(list))
}