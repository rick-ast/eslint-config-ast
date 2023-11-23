/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-check
const reactHooksPlugin = require('eslint-plugin-react-hooks')

const reactHooksCreate = reactHooksPlugin.rules['exhaustive-deps'].create

const hook = 'useRequest'
const depKey = 'refreshDeps'

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: `verifies the list of dependencies for ${hook}`,
      category: 'Possible Errors',
      recommended: true,
    },
    fixable: 'code',
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        autoFix: false,
        properties: {
          autoFix: {
            type: 'boolean',
          },
        },
      },
    ],
  },
  create(context) {
    return {
      CallExpression: function (node) {
        if (node.callee.type === 'Identifier' && node.callee.name === hook) {
          const arg1 = node.arguments[1]
          let manual = false
          let refreshDeps
          let range
          if (arg1?.type === 'ObjectExpression') {
            for (const prop of arg1.properties) {
              if (prop.key.name === depKey) {
                refreshDeps = prop.value.elements
                range = prop.value.range
              } else if (prop.key.name === 'manual' && prop.value.value) {
                manual = true
              }
            }
          }

          if (manual) return

          node.arguments[1] = {
            type: 'ArrayExpression',
            elements: refreshDeps ?? [],
            loc: node.loc,
            parent: node.parent,
            range: range ?? node.range,
          }

          const report = (problem) => {
            problem.message = problem.message.replace(
              /Either include (it|them) or remove the dependency array/,
              `Please add $1 to 'options.${depKey}'`,
            )
            const suggest = problem.suggest[0]
            const fix = (fixer) => {
              if (range) {
                return suggest.fix(fixer)
              }

              let depsText
              suggest.fix({
                replaceText: function (_, deps) {
                  depsText = deps
                },
              })
              const replacementText = `${depKey}: ${depsText}`

              if (arg1) {
                const arg1Text = context.sourceCode.getText(arg1)
                return fixer.replaceText(
                  arg1,
                  `${arg1Text.replace(
                    /,?\s*\}\s*,?$/,
                    '',
                  )} ${replacementText} }`,
                )
              }

              const nodeText = context.sourceCode.getText(node)
              return fixer.replaceText(
                node,
                `${nodeText.replace(
                  /,?\s*\)\s*,?$/,
                  '',
                )} { ${replacementText} })`,
              )
            }
            problem.fix = context.options[0]?.autoFix && fix
            problem.suggest = [
              {
                desc: suggest.desc,
                fix,
              },
            ]

            context.report(problem)
          }

          const reactHooksCallExpression = reactHooksCreate({
            options: [{ additionalHooks: `(${hook})` }],
            report,
            getScope: context.getScope,
            getSource: context.getSource,
            getSourceCode: context.getSourceCode,
            sourceCode: context.sourceCode,
          }).CallExpression

          reactHooksCallExpression(node)
        }
      },
    }
  },
}