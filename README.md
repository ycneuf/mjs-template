# jms-template

Moteur de template (très) simple.
Un template est un fragment de document HTML sur lequel on vient appliquer une donnée (généralement un objet, mais toute donnée, y compris _null_ est acceptée).
 
Les templates peuvent être dans le document HTML lui même (ce sont les éléments `<template id="id">`) ou dans des fichiers distincts.Update README.md

## Principe de fonctionnement

Dans les exemples, on suppose que le module a été importé de la façon suivante :
<code>
import * as template from "some_path/template.js"
</code>

### Définir la donnée

 Pour définir la donnée courante, il faut utiliser soit l'attribut `template-data`, soit l'attribute `template-data-src`.
 - `template-data-src="url"` : la données courante est chargée depuis l'URL (format Json)
 - `template-data="expression"` : la donnée courante est le résultat de l'évaluation de `expression``  
 
Si `template-data-src`et `template-data` sont tous les deux présents, on télécharge d'abord la donnée avec `template-data-src`
puis on la transforme en la remplaçant par le résultat de l'expression donnée par `template-data`.

### Scanner le document
 Le moteur de template recherche les éléments du document qui ont l'attribut `template` et/ou l'attribut `template-src`.
 - `template="id"` désigne l'élement `<template id="id">`dans le document HTML
 - `template-src="url"` indique que le template doit être chargé depuis une URL
 L'élément est alors remplacé par l'application de la donnée courante au template.
 Nota :  Si les deux attributs sont présents, `template` est priorisé.
 Toutefois, si le template indiqué n'existe pas, le moteur utilisera l'attribut `template-src`.

Supposons un document HTML :

<code>
&lt;html&gt;
 &lt;head&gt; ... &lt;/head&gt;
 &lt;body&gt;
   &lt;div id="header"&gt;&lt;h1&gt;Titre&lt;/h1&gt;&lt;/div&gt;
   &lt;div id="main" template_src="./templates/main.html"&gt;&lt;/div&gt;
 &lt;/body&gt;
&lt;/html&gt;
</code>

Pour lancer le scan depuis la racine du document HTML, il suffit d'invoquer<code>template.scan(document.body);</code>.
Mais il est aussi possible de :
- scanner à partir d'un élément du document : <code>template.scan(document.getElementById("main");</code>
- scanner en fournissant la donnée : <code>template.scan(document.getElementById("main"), some_data)</code>

Autre, si nous avons dans notre document HTML :
<code>
&lt;div template="liste_clients" template-data-src="api/clients/123"/&gt;;
...
&lt;template id="fiche_client"&gt; ... &lt;/&gt;
</code>

Le scan du document remplacer l'élément <div> par le résultat de l'application de la données téléchargée en `api/clients/123` au template "fiche_client".

### Application

Il est possible d'appliquer une donnée à un template et de remplacer un élément par le résultat de cette application.
C'est ce que fait la fonction `template.appy(templateElement, element, data)`.

### Evaluation des expressions

 Lors de l'application de la donnée au template, les motifs `{expression}` dans les attributs ou dans les noeuds texte sont remplacés par le résultat de l'évaluation
 de l'expression.
 
 L'expression doit être une expression javascript valide.
 Elle est evaluée dans la portée globale (donc `window`, `document` et toutes les variables globales sont accessibles).
 La variable `data` contient la donnée courante.

 ### A l'intérieur du template ...
 
 A l'intérieur du template, deux attributs sont disponibles.
 - `template-if="expression"`: ne traite l'élément que si le résultat de l'évaluation de l'expression a la valeur `true`, ou équivalente. Sinon, cet élément est ignoré.
 - `template-foreach="expression"` : si le résultat de l'évaluation de l'expression est un [itérable](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Iteration_protocols),
 clone l'élément pour chaque item de l'itérable. Sinon ignore l'élément. A noter que l'élément est remplacé par les clones, donc si l'itérable est une liste vide, l'élément est simplement supprimé.
  
 Il est bien évidemment possible, à l'intérieur d'un template, de redéfinir la donnée courante avec `template-data` et `template-data-src` ou même de refaire un templating interne avec `template` ou `template-src`.
 
